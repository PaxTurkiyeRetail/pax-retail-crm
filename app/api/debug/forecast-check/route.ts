import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GEÇİCİ TEŞHİS ENDPOINT'İ — Forecast eksik listesi gerçeği yansıtmıyor mu diye kontrol için.
// İş bitince silinecek.
export async function GET() {
  try {
    await requireReportsAccessOrThrow();
    const year = new Date().getFullYear();
    const result = await db.query(
      `
      select m.id::text, m.musteri, m.sorumlu,
             kv.satici_etiketi,
             (select count(*) from public.crm_forecasts f where f.customer_id = m.id) as any_year_count,
             (select count(*) from public.crm_forecasts f where f.customer_id = m.id and f.is_active = true) as active_count,
             (select array_agg(distinct f.forecast_year) from public.crm_forecasts f where f.customer_id = m.id) as years,
             (select count(*) from public.crm_forecasts f where f.customer_id = m.id and f.is_active = true and f.forecast_year = $1) as current_year_active_count
      from public.musteriler m
      left join public.musteri_kunye_v2 kv on kv.musteri_id = m.id
      where m.sorumlu ilike '%Furkan%'
        and lower(trim(coalesce(kv.satici_etiketi, ''))) <> 'farmer'
      order by m.musteri
      limit 50
      `,
      [year],
    );
    return NextResponse.json({ year, rows: result.rows });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'hata' }, { status: error?.status || 500 });
  }
}
