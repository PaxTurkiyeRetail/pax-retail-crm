import { NextResponse } from 'next/server';
import { requireAnyPermissionOrThrow, userHasPermission } from '@/lib/authz';
import { db } from '@/lib/db';
import { isMissingForecastRelation } from '@/lib/forecast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const me = await requireAnyPermissionOrThrow(['forecast.write.own', 'forecast.write.any']);
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = String(body.id ?? '').trim();
    const canSeeAll = userHasPermission(me, 'forecast.write.any');

    if (!id) return NextResponse.json({ message: 'Forecast id zorunlu.' }, { status: 400 });

    const existing = await db.query(
      `select f.id::text, c.owner_user_id::text as owner_user_id
       from public.crm_forecasts f
       join public.musteriler c on c.id = f.customer_id
       where f.id = $1::uuid and f.is_active = true limit 1`,
      [id],
    );
    const row = existing.rows[0];
    if (!row) return NextResponse.json({ message: 'Forecast kaydi bulunamadi.' }, { status: 404 });
    if (!canSeeAll && String(row.owner_user_id ?? '') !== me.id) {
      return NextResponse.json({ message: 'Bu forecast kaydini silme yetkiniz yok.' }, { status: 403 });
    }

    try {
      await db.query(
        `update public.crm_forecasts set is_active = false, updated_by_email = $2, updated_by_name = $3, updated_at = now() where id = $1::uuid`,
        [id, me.email, String(me.full_name ?? me.email ?? '').trim()],
      );
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (isMissingForecastRelation(error)) return NextResponse.json({ message: 'forecast_module_not_setup' }, { status: 400 });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Forecast silinemedi.' }, { status: error?.status || 500 });
  }
}
