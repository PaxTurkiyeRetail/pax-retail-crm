import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { canSeeAllForecasts, FORECAST_MONTHS, getForecastParameterOptions, isMissingForecastRelation, samePersonName, toPositiveInt } from '@/lib/forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ForecastItem = {
  product_id?: string;
  quantity?: number | string;
  forecast_year?: number | string;
  forecast_month?: number | string;
  sales_channel?: string;
  probability?: number | string;
  note?: string | null;
};

type Body = ForecastItem & {
  customer_id?: string;
  items?: ForecastItem[];
};

function validYear(value: number) {
  return Number.isFinite(value) && value >= 2024 && value <= 2100;
}

function normalizeItems(body: Body): ForecastItem[] {
  if (Array.isArray(body.items) && body.items.length) return body.items;
  return [{
    product_id: body.product_id,
    quantity: body.quantity,
    forecast_year: body.forecast_year,
    forecast_month: body.forecast_month,
    sales_channel: body.sales_channel,
    probability: body.probability,
    note: body.note,
  }];
}

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const customerId = String(body.customer_id ?? '').trim();
    const ownerName = String(me.full_name ?? '').trim();
    const canSeeAll = canSeeAllForecasts(me.role);

    if (!ownerName && !canSeeAll) return NextResponse.json({ message: 'Kullanici ad soyad bilgisi bulunamadi.' }, { status: 400 });
    if (!customerId) return NextResponse.json({ message: 'Musteri secimi zorunlu.' }, { status: 400 });

    const items = normalizeItems(body).map((item, index) => ({
      index: index + 1,
      productId: String(item.product_id ?? '').trim(),
      quantity: toPositiveInt(item.quantity, 0),
      forecastYear: toPositiveInt(item.forecast_year, 0),
      forecastMonth: toPositiveInt(item.forecast_month, 0),
      salesChannel: String(item.sales_channel ?? '').trim(),
      probability: toPositiveInt(item.probability, 0),
      note: String(item.note ?? '').trim() || null,
    }));

    if (!items.length) return NextResponse.json({ message: 'En az bir forecast satiri girilmeli.' }, { status: 400 });
    if (items.length > 50) return NextResponse.json({ message: 'Tek kayitta en fazla 50 forecast satiri eklenebilir.' }, { status: 400 });

    const params = await getForecastParameterOptions();
    const allowedChannels = new Set(params.channels.map((item) => item.value));
    const allowedProbabilities = new Set(params.probabilities.map((item) => Number(item.value)));

    for (const item of items) {
      if (!item.productId) return NextResponse.json({ message: `${item.index}. satirda urun secimi zorunlu.` }, { status: 400 });
      if (!item.quantity) return NextResponse.json({ message: `${item.index}. satirda adet pozitif sayi olmali.` }, { status: 400 });
      if (!validYear(item.forecastYear)) return NextResponse.json({ message: `${item.index}. satirda forecast yili gecersiz.` }, { status: 400 });
      if (!FORECAST_MONTHS.some((month) => month.value === item.forecastMonth)) return NextResponse.json({ message: `${item.index}. satirda forecast ayi gecersiz.` }, { status: 400 });
      if (!allowedChannels.has(item.salesChannel)) return NextResponse.json({ message: `${item.index}. satirda satis kanali gecersiz.` }, { status: 400 });
      if (!allowedProbabilities.has(item.probability)) return NextResponse.json({ message: `${item.index}. satirda gerceklesme orani gecersiz.` }, { status: 400 });
    }

    const customerCheck = await db.query(
      `select id::text, musteri, sorumlu from public.musteriler where id = $1::uuid limit 1`,
      [customerId],
    );
    const customer = customerCheck.rows[0];
    if (!customer) return NextResponse.json({ message: 'Musteri bulunamadi.' }, { status: 404 });
    if (!canSeeAll && !samePersonName(customer.sorumlu, ownerName)) {
      return NextResponse.json({ message: 'Bu musteri sizin portfoyunuzde degil veya bulunamadi.' }, { status: 403 });
    }
    const forecastOwnerName = String(customer.sorumlu ?? '').trim() || ownerName || String(me.email ?? '').trim();
    const actorName = ownerName || String(me.email ?? '').trim();

    const admin = createPgAdminClient();
    const { products } = await getQuoteCatalog(admin);
    const productMap = new Map<string, any>();
    for (const product of products) {
      productMap.set(String(product.id), product);
      productMap.set(String(product.code), product);
    }

    for (const item of items) {
      if (!productMap.has(item.productId)) return NextResponse.json({ message: `${item.index}. satirda urun bulunamadi.` }, { status: 400 });
    }

    const client = await db.connect();
    try {
      await client.query('begin');
      const inserted: any[] = [];
      for (const item of items) {
        const product = productMap.get(item.productId);
        const result = await client.query(
          `
            insert into public.crm_forecasts (
              customer_id, product_id, product_code_snapshot, product_name_snapshot, quantity,
              forecast_year, forecast_month, sales_channel, probability,
              owner_name, owner_email, note, created_by_email, created_by_name, updated_by_email, updated_by_name
            )
            values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $11, $13, $11, $13)
            returning id::text, customer_id::text, product_id, product_code_snapshot, product_name_snapshot, quantity,
                      forecast_year, forecast_month, sales_channel, probability, owner_name, owner_email, note,
                      created_at::text, updated_at::text
          `,
          [
            customerId,
            String(product.id),
            product.code,
            product.name,
            item.quantity,
            item.forecastYear,
            item.forecastMonth,
            item.salesChannel,
            item.probability,
            forecastOwnerName,
            me.email,
            item.note,
            actorName,
          ],
        );
        inserted.push(result.rows[0]);
      }
      await client.query('commit');
      return NextResponse.json({ ok: true, count: inserted.length, rows: inserted, row: inserted[0] ?? null });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      if (isMissingForecastRelation(error)) return NextResponse.json({ message: 'forecast_module_not_setup' }, { status: 400 });
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Forecast kaydedilemedi.' }, { status: error?.status || 500 });
  }
}
