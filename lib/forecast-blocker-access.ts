import 'server-only';
import { db } from '@/lib/db';
import { canSeeAllForecasts, samePersonName } from '@/lib/forecast-shared';
import type { AllowedUser } from '@/lib/authz';

export type ForecastAccessRow = {
  forecast_id: string;
  customer_id: string;
  musteri: string;
  sorumlu: string | null;
  quantity: number;
  forecast_year: number;
  forecast_month: number;
  product_code_snapshot: string | null;
  product_name_snapshot: string;
  is_active: boolean;
};

export async function getForecastForBlockerOrThrow(me: AllowedUser, forecastId: string): Promise<ForecastAccessRow> {
  const result = await db.query(
    `
      select
        f.id::text as forecast_id,
        f.customer_id::text as customer_id,
        m.musteri,
        m.sorumlu,
        f.quantity,
        f.forecast_year,
        f.forecast_month,
        f.product_code_snapshot,
        f.product_name_snapshot,
        f.is_active
      from public.crm_forecasts f
      join public.musteriler m on m.id = f.customer_id
      where f.id = $1::uuid
      limit 1
    `,
    [forecastId],
  );
  const row = result.rows[0] as ForecastAccessRow | undefined;
  if (!row) throw Object.assign(new Error('Forecast kaydı bulunamadı.'), { status: 404 });
  if (!row.is_active) throw Object.assign(new Error('Pasif Forecast kaydı güncellenemez.'), { status: 400 });
  if (!canSeeAllForecasts(me.role) && !samePersonName(row.sorumlu, me.full_name)) {
    throw Object.assign(new Error('Bu proje sizin portföyünüzde değil.'), { status: 403 });
  }
  return row;
}
