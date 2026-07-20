import 'server-only';
import { db } from '@/lib/db';
import { canSeeAllForecasts, samePersonName } from '@/lib/forecast-shared';
import type { AllowedUser } from '@/lib/authz';

export type CustomerBlockerAccessRow = {
  customer_id: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
};

export type CustomerForecastAccessRow = {
  forecast_id: string;
  customer_id: string;
  quantity: number;
  forecast_year: number;
  forecast_month: number;
  product_code_snapshot: string | null;
  product_name_snapshot: string;
  is_active: boolean;
};

export async function getCustomerForBlockerOrThrow(
  me: AllowedUser,
  customerId: string,
): Promise<CustomerBlockerAccessRow> {
  const result = await db.query(
    `
      select
        m.id::text as customer_id,
        m.musteri,
        m.sektor,
        m.sorumlu
      from public.musteriler m
      where m.id = $1::uuid
      limit 1
    `,
    [customerId],
  );

  const row = result.rows[0] as CustomerBlockerAccessRow | undefined;
  if (!row) throw Object.assign(new Error('Müşteri kaydı bulunamadı.'), { status: 404 });

  if (!canSeeAllForecasts(me.role) && !samePersonName(row.sorumlu, me.full_name)) {
    throw Object.assign(new Error('Bu müşteri sizin portföyünüzde değil.'), { status: 403 });
  }

  return row;
}

export async function getCustomerForecastOrThrow(
  customerId: string,
  forecastId: string,
): Promise<CustomerForecastAccessRow> {
  const result = await db.query(
    `
      select
        f.id::text as forecast_id,
        f.customer_id::text as customer_id,
        f.quantity,
        f.forecast_year,
        f.forecast_month,
        f.product_code_snapshot,
        f.product_name_snapshot,
        f.is_active
      from public.crm_forecasts f
      where f.id = $1::uuid
        and f.customer_id = $2::uuid
      limit 1
    `,
    [forecastId, customerId],
  );

  const row = result.rows[0] as CustomerForecastAccessRow | undefined;
  if (!row) throw Object.assign(new Error('Seçilen Forecast bu müşteriye ait değil.'), { status: 400 });
  if (!row.is_active) throw Object.assign(new Error('Pasif Forecast bütçe etkisi için seçilemez.'), { status: 400 });
  return row;
}
