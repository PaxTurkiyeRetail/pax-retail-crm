import { NextResponse } from 'next/server';
import { getUserDepartments, requireReportsAccessOrThrow } from '@/lib/authz';
import { resolveDepartmentFilter } from '@/lib/departments';
import { parseFilters } from '@/lib/filters/schema';
import { forecastFilterConfig } from '@/lib/reports/forecast-filters';
import { resolveOwner } from '@/lib/reports/owner-filter';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import { db } from '@/lib/db';
import { FORECAST_MONTHS, buildForecastYears, getForecastParameterOptions, isMissingForecastRelation, monthLabel, normalizeText, toPositiveInt } from '@/lib/forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function moneyQty(value: number) {
  return Math.round(Number(value || 0));
}

function summarize<T extends string>(rows: any[], keyFn: (row: any) => T, valueFn = (row: any) => Number(row.quantity ?? 0)) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(keyFn(row) || '-').trim() || '-';
    map.set(key, (map.get(key) ?? 0) + valueFn(row));
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value: moneyQty(value) })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

export async function GET(request: Request) {
  try {
    const me = await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const allowedDepartments = await getUserDepartments(me);
    const ownerOptions = await loadOwnerOptions({ departments: allowedDepartments });
    const filters = parseFilters(url.searchParams, forecastFilterConfig(ownerOptions), { allowedDepartments });
    const q = filters.q ?? '';
    const owner = resolveOwner(filters.owner, ownerOptions);
    const departments = resolveDepartmentFilter(filters.department, allowedDepartments);
    const channel = String(url.searchParams.get('channel') ?? '').trim();
    const probability = toPositiveInt(url.searchParams.get('probability'), 0);
    const year = toPositiveInt(url.searchParams.get('year'), 0);
    const month = toPositiveInt(url.searchParams.get('month'), 0);

    const params: any[] = [];
    const clauses = ['f.is_active = true'];
    // Satıcı: kullanıcı id ile (owner_user_id); id'siz eski kayıtlar tam ad eşleşmesiyle.
    if (owner?.id) {
      params.push(owner.id, owner.name);
      clauses.push(`(f.owner_user_id = $${params.length - 1} or (nullif(f.owner_user_id, '') is null and trim(f.owner_name) = $${params.length}))`);
    } else if (owner) {
      params.push(owner.name);
      clauses.push(`trim(f.owner_name) = $${params.length}`);
    }
    if (departments) { params.push(departments); clauses.push(`m.is_kolu = any($${params.length}::text[])`); }
    if (channel) { params.push(channel); clauses.push(`f.sales_channel = $${params.length}`); }
    if (probability) { params.push(probability); clauses.push(`f.probability = $${params.length}`); }
    if (year) { params.push(year); clauses.push(`f.forecast_year = $${params.length}`); }
    if (month) { params.push(month); clauses.push(`f.forecast_month = $${params.length}`); }

    const sql = `
      select f.id::text, f.customer_id::text, f.product_id, f.product_code_snapshot, f.product_name_snapshot,
             f.quantity, f.forecast_year, f.forecast_month, f.sales_channel, f.probability,
             f.owner_name, f.owner_email, f.note, f.created_at::text, f.updated_at::text,
             m.musteri, m.sektor, m.sorumlu, m.entegrasyon_tipi
      from public.crm_forecasts f
      join public.musteriler m on m.id = f.customer_id
      where ${clauses.join(' and ')}
      order by f.forecast_year asc, f.forecast_month asc, f.owner_name asc, m.musteri asc, f.product_name_snapshot asc
    `;

    let rows: any[];
    try {
      rows = (await db.query(sql, params)).rows;
    } catch (error) {
      if (isMissingForecastRelation(error)) {
        const forecastParams = await getForecastParameterOptions();
        return NextResponse.json({ onboardingNeeded: true, message: 'forecast_module_not_setup', rows: [], ownerOptions, allowedDepartments, salesChannels: forecastParams.channels, probabilities: forecastParams.probabilities, months: FORECAST_MONTHS, years: buildForecastYears() });
      }
      throw error;
    }

    if (q) {
      const needle = normalizeText(q);
      rows = rows.filter((row) => [row.musteri, row.sektor, row.sorumlu, row.entegrasyon_tipi, row.product_code_snapshot, row.product_name_snapshot, row.sales_channel, row.owner_name].some((value) => normalizeText(value).includes(needle)));
    }

    // Yıl listesi filtreden bağımsız: kayıtlı tüm yıllar + giriş ekranının yılları.
    const yearRows = await db.query(`select distinct forecast_year from public.crm_forecasts where is_active = true`);
    const years = Array.from(new Set([...yearRows.rows.map((row: any) => Number(row.forecast_year)), ...buildForecastYears()].filter(Boolean))).sort((a, b) => a - b);
    const forecastParams = await getForecastParameterOptions();

    const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    const weightedQuantity = rows.reduce((sum, row) => sum + (Number(row.quantity ?? 0) * Number(row.probability ?? 0) / 100), 0);
    const uniqueCustomers = new Set(rows.map((row) => String(row.customer_id ?? '')).filter(Boolean)).size;
    const uniqueOwners = new Set(rows.map((row) => String(row.owner_name ?? '')).filter(Boolean)).size;

    const monthSummary = summarize(rows, (row) => monthLabel(Number(row.forecast_month), Number(row.forecast_year)));
    const ownerSummary = summarize(rows, (row) => row.owner_name);
    const channelSummary = summarize(rows, (row) => row.sales_channel);
    const probabilitySummary = summarize(rows, (row) => `%${row.probability}`);
    const productSummary = summarize(rows, (row) => row.product_name_snapshot).slice(0, 20);

    return NextResponse.json({
      onboardingNeeded: false,
      filters: { q, owner: owner?.value ?? '', department: filters.department ?? '', channel, probability, year, month },
      ownerOptions,
      allowedDepartments,
      salesChannels: forecastParams.channels,
      probabilities: forecastParams.probabilities,
      months: FORECAST_MONTHS,
      years,
      summary: {
        totalLines: rows.length,
        uniqueCustomers,
        uniqueOwners,
        totalQuantity: moneyQty(totalQuantity),
        weightedQuantity: moneyQty(weightedQuantity),
      },
      monthSummary,
      ownerSummary,
      channelSummary,
      probabilitySummary,
      productSummary,
      rows: rows.map((row) => ({ ...row, forecast_label: monthLabel(Number(row.forecast_month), Number(row.forecast_year)) })),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Forecast raporu alinamadi.' }, { status: error?.status || 500 });
  }
}
