import { NextResponse } from 'next/server';
import { requireAnyPermissionOrThrow, userHasPermission } from '@/lib/authz';
import { db } from '@/lib/db';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { FORECAST_MONTHS, getForecastParameterOptions, isMissingForecastRelation, toPositiveInt } from '@/lib/forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  id?: string;
  product_id?: string;
  quantity?: number | string;
  forecast_year?: number | string;
  forecast_month?: number | string;
  sales_channel?: string;
  probability?: number | string;
  note?: string | null;
};

function validYear(value: number) {
  return Number.isFinite(value) && value >= 2024 && value <= 2100;
}

export async function POST(request: Request) {
  try {
    const me = await requireAnyPermissionOrThrow(['forecast.write.own', 'forecast.write.any']);
    const body = (await request.json().catch(() => ({}))) as Body;
    const id = String(body.id ?? '').trim();
    const canSeeAll = userHasPermission(me, 'forecast.write.any');

    if (!id) return NextResponse.json({ message: 'Forecast id zorunlu.' }, { status: 400 });

    const productId = String(body.product_id ?? '').trim();
    const quantity = toPositiveInt(body.quantity, 0);
    const forecastYear = toPositiveInt(body.forecast_year, 0);
    const forecastMonth = toPositiveInt(body.forecast_month, 0);
    const salesChannel = String(body.sales_channel ?? '').trim();
    const probability = toPositiveInt(body.probability, 0);
    const note = String(body.note ?? '').trim() || null;

    if (!productId) return NextResponse.json({ message: 'Urun secimi zorunlu.' }, { status: 400 });
    if (!quantity) return NextResponse.json({ message: 'Adet pozitif sayi olmali.' }, { status: 400 });
    if (!validYear(forecastYear)) return NextResponse.json({ message: 'Forecast yili gecersiz.' }, { status: 400 });
    if (!FORECAST_MONTHS.some((month) => month.value === forecastMonth)) return NextResponse.json({ message: 'Forecast ayi gecersiz.' }, { status: 400 });

    const params = await getForecastParameterOptions();
    const allowedChannels = new Set(params.channels.map((item) => item.value));
    const allowedProbabilities = new Set(params.probabilities.map((item) => Number(item.value)));
    if (!allowedChannels.has(salesChannel)) return NextResponse.json({ message: 'Satis kanali gecersiz.' }, { status: 400 });
    if (!allowedProbabilities.has(probability)) return NextResponse.json({ message: 'Gerceklesme orani gecersiz.' }, { status: 400 });

    const existing = await db.query(
      `select f.id::text, f.customer_id::text, c.owner_user_id::text as owner_user_id
       from public.crm_forecasts f
       join public.musteriler c on c.id = f.customer_id
       where f.id = $1::uuid and f.is_active = true limit 1`,
      [id],
    );
    const row = existing.rows[0];
    if (!row) return NextResponse.json({ message: 'Forecast kaydi bulunamadi.' }, { status: 404 });
    if (!canSeeAll && String(row.owner_user_id ?? '') !== me.id) {
      return NextResponse.json({ message: 'Bu forecast kaydini duzenleme yetkiniz yok.' }, { status: 403 });
    }

    const admin = createPgAdminClient();
    const { products } = await getQuoteCatalog(admin);
    const product = products.find((item: any) => String(item.id) === productId || String(item.code) === productId);
    if (!product) return NextResponse.json({ message: 'Urun bulunamadi.' }, { status: 400 });

    const actorName = String(me.full_name ?? me.email ?? '').trim();

    try {
      const result = await db.query(
        `
          update public.crm_forecasts set
            product_id = $2, product_code_snapshot = $3, product_name_snapshot = $4, quantity = $5,
            forecast_year = $6, forecast_month = $7, sales_channel = $8, probability = $9,
            note = $10, updated_by_email = $11, updated_by_name = $12, updated_at = now()
          where id = $1::uuid
          returning id::text, customer_id::text, product_id, product_code_snapshot, product_name_snapshot, quantity,
                    forecast_year, forecast_month, sales_channel, probability, owner_name, owner_email, note,
                    created_at::text, updated_at::text
        `,
        [id, String(product.id), product.code, product.name, quantity, forecastYear, forecastMonth, salesChannel, probability, note, me.email, actorName],
      );
      return NextResponse.json({ ok: true, row: result.rows[0] });
    } catch (error) {
      if (isMissingForecastRelation(error)) return NextResponse.json({ message: 'forecast_module_not_setup' }, { status: 400 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Forecast guncellenemedi.' }, { status: error?.status || 500 });
  }
}
