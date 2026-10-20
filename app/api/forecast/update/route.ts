import { NextResponse } from 'next/server';
import { requireAnyPermissionOrThrow, userHasPermission } from '@/lib/authz';
import { db } from '@/lib/db';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { FORECAST_MONTHS, getForecastParameterOptions, isMissingForecastRelation, toPositiveInt } from '@/lib/forecast';
import { parseForecastPricing } from '@/lib/forecast-pricing';

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
  /** 045: gönderilmeyen alan mevcut değerini korur. */
  sale_type?: string;
  unit_price?: number | string | null;
  rental_monthly_price?: number | string | null;
  include_in_retail_plan?: boolean | string | null;
  expected_updated_at?: string;
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
    const expected = body.expected_updated_at;
    if (expected !== undefined && (typeof expected !== 'string' || expected.length > 80 || !Number.isFinite(Date.parse(expected)))) {
      return NextResponse.json({ message: 'Forecast sürümü geçersiz. Raporu yenileyin.' }, { status: 400 });
    }

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
      `select f.id::text, f.customer_id::text, c.owner_user_id::text as owner_user_id,
              to_jsonb(f) ->> 'sale_type' as sale_type, to_jsonb(f) ->> 'unit_price' as unit_price,
              to_jsonb(f) ->> 'rental_monthly_price' as rental_monthly_price,
              to_jsonb(f) ->> 'include_in_retail_plan' as include_in_retail_plan
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

    const has = (key: keyof Body) => Object.prototype.hasOwnProperty.call(body, key);
    const pricing = parseForecastPricing({
      sale_type: has('sale_type') ? body.sale_type : row.sale_type,
      unit_price: has('unit_price') ? body.unit_price : row.unit_price,
      rental_monthly_price: has('rental_monthly_price') ? body.rental_monthly_price : row.rental_monthly_price,
      include_in_retail_plan: has('include_in_retail_plan') ? body.include_in_retail_plan : row.include_in_retail_plan,
    }, product);
    if (!pricing.ok) return NextResponse.json({ message: pricing.message }, { status: 400 });

    const actorName = String(me.full_name ?? me.email ?? '').trim();

    try {
      const result = await db.query(
        `
          update public.crm_forecasts set
            product_id = $2, product_code_snapshot = $3, product_name_snapshot = $4, quantity = $5,
            forecast_year = $6, forecast_month = $7, sales_channel = $8, probability = $9,
            note = $10, updated_by_email = $11, updated_by_name = $12, updated_at = now(),
            sale_type = $13, unit_price = $14, rental_monthly_price = $15, include_in_retail_plan = $16
          where id = $1::uuid and is_active=true
            and ($17::timestamptz is null or updated_at=$17::timestamptz)
            and exists(select 1 from public.musteriler customer where customer.id=crm_forecasts.customer_id
              and ($18::boolean or customer.owner_user_id=$19::uuid))
          returning id::text, customer_id::text, product_id, product_code_snapshot, product_name_snapshot, quantity,
                    forecast_year, forecast_month, sales_channel, probability, owner_name, owner_email, note,
                    sale_type, unit_price::float8 as unit_price, rental_monthly_price::float8 as rental_monthly_price, include_in_retail_plan,
                    created_at::text, updated_at::text
        `,
        [id, String(product.id), product.code, product.name, quantity, forecastYear, forecastMonth, salesChannel, probability, note, me.email, actorName,
          pricing.value.saleType, pricing.value.unitPrice, pricing.value.rentalMonthlyPrice, pricing.value.includeInRetailPlan,
          expected ?? null, canSeeAll, me.id],
      );
      if (!result.rows.length) return NextResponse.json({ message: 'Forecast başka bir kullanıcı tarafından değiştirildi veya artık erişilemiyor. Raporu yenileyin.' }, { status: 409 });
      return NextResponse.json({ ok: true, row: result.rows[0] });
    } catch (error) {
      if (isMissingForecastRelation(error)) return NextResponse.json({ message: 'forecast_module_not_setup' }, { status: 400 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Forecast guncellenemedi.' }, { status: error?.status || 500 });
  }
}
