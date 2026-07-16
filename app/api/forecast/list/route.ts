import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';
import { canSeeAllForecasts, isMissingForecastRelation, monthLabel, normalizeText, sanitizeLike, toPositiveInt } from '@/lib/forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ForecastLine = {
  id: string;
  customer_id: string;
  product_id: string | null;
  product_code_snapshot: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  forecast_year: number;
  forecast_month: number;
  sales_channel: string;
  probability: number;
  owner_name: string | null;
  owner_email: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function parsePage(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim();
    const status = String(url.searchParams.get('status') ?? '').trim();
    const year = toPositiveInt(url.searchParams.get('year'), 0);
    const month = toPositiveInt(url.searchParams.get('month'), 0);
    const page = parsePage(url.searchParams.get('page'), 1);
    const pageSize = Math.min(parsePage(url.searchParams.get('pageSize'), 20), 100);
    const offset = (page - 1) * pageSize;

    const ownerName = String(me.full_name ?? '').trim();
    const canSeeAll = canSeeAllForecasts(me.role);
    if (!ownerName && !canSeeAll) {
      return NextResponse.json({ rows: [], total: 0, page, pageSize, onboardingNeeded: false, message: 'Kullanici ad soyad bilgisi bulunamadi.' });
    }

    const customerSql = canSeeAll ? `
      select id::text as musteri_id, musteri, sektor, sorumlu, entegrasyon_tipi, satis_olasiligi
      from public.musteriler
      order by musteri asc
    ` : `
      select id::text as musteri_id, musteri, sektor, sorumlu, entegrasyon_tipi, satis_olasiligi
      from public.musteriler
      where lower(trim(coalesce(sorumlu, ''))) = lower(trim($1))
      order by musteri asc
    `;
    const customerResult = await db.query(customerSql, canSeeAll ? [] : [ownerName]);
    let customers = customerResult.rows.filter((row: any) => !isReportOnlyCustomer(row));

    if (q) {
      const needle = normalizeText(q);
      customers = customers.filter((row: any) => [row.musteri, row.sektor, row.sorumlu, row.entegrasyon_tipi].some((value) => normalizeText(value).includes(needle)));
    }

    const ids = customers.map((row: any) => row.musteri_id).filter(Boolean);
    let forecastRows: ForecastLine[] = [];

    if (ids.length) {
      const params: any[] = [ids];
      const clauses = ['customer_id = any($1::uuid[])', 'is_active = true'];
      if (year) { params.push(year); clauses.push(`forecast_year = $${params.length}`); }
      if (month) { params.push(month); clauses.push(`forecast_month = $${params.length}`); }
      const forecastSql = `
        select id::text, customer_id::text, product_id, product_code_snapshot, product_name_snapshot, quantity,
               forecast_year, forecast_month, sales_channel, probability, owner_name, owner_email, note,
               created_at::text, updated_at::text
        from public.crm_forecasts
        where ${clauses.join(' and ')}
        order by forecast_year asc, forecast_month asc, product_name_snapshot asc, created_at desc
      `;
      try {
        forecastRows = (await db.query(forecastSql, params)).rows as ForecastLine[];
      } catch (error) {
        if (isMissingForecastRelation(error)) {
          return NextResponse.json({ rows: [], total: 0, page, pageSize, onboardingNeeded: true, message: 'forecast_module_not_setup' });
        }
        throw error;
      }
    } else {
      try {
        await db.query('select 1 from public.crm_forecasts limit 1');
      } catch (error) {
        if (isMissingForecastRelation(error)) {
          return NextResponse.json({ rows: [], total: 0, page, pageSize, onboardingNeeded: true, message: 'forecast_module_not_setup' });
        }
        throw error;
      }
    }

    const forecastMap = new Map<string, ForecastLine[]>();
    for (const line of forecastRows) {
      const list = forecastMap.get(line.customer_id) ?? [];
      list.push(line);
      forecastMap.set(line.customer_id, list);
    }

    let rows = customers.map((customer: any) => {
      const lines = forecastMap.get(customer.musteri_id) ?? [];
      const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
      const weightedQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity ?? 0) * Number(line.probability ?? 0) / 100), 0);
      return {
        ...customer,
        hasForecast: lines.length > 0,
        forecastCount: lines.length,
        totalQuantity,
        weightedQuantity,
        latestForecastLabel: lines[0] ? monthLabel(lines[0].forecast_month, lines[0].forecast_year) : null,
        forecasts: lines.map((line) => ({ ...line, forecast_label: monthLabel(line.forecast_month, line.forecast_year) })),
      };
    });

    if (status === 'entered') rows = rows.filter((row: any) => row.hasForecast);
    if (status === 'missing') rows = rows.filter((row: any) => !row.hasForecast);

    const total = rows.length;
    rows = rows.slice(offset, offset + pageSize);

    const entered = customers.filter((row: any) => (forecastMap.get(row.musteri_id) ?? []).length > 0).length;
    const missing = Math.max(customers.length - entered, 0);

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      ownerName: canSeeAll ? 'Tüm Accountlar' : ownerName,
      scope: canSeeAll ? 'all' : 'own',
      filters: { q, status, year, month },
      summary: {
        totalCustomers: customers.length,
        enteredCustomers: entered,
        missingCustomers: missing,
        completionRate: customers.length ? Math.round((entered / customers.length) * 100) : 0,
        totalQuantity: forecastRows.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0),
        weightedQuantity: Math.round(forecastRows.reduce((sum, line) => sum + (Number(line.quantity ?? 0) * Number(line.probability ?? 0) / 100), 0)),
      },
      onboardingNeeded: false,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Forecast listesi alinamadi.' }, { status: error?.status || 500 });
  }
}
