import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { getForecastForBlockerOrThrow } from '@/lib/forecast-blocker-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = await request.json().catch(() => ({}));
    const forecastId = String(body.forecast_id ?? '').trim();
    await getForecastForBlockerOrThrow(me, forecastId);
    const actorName = String(me.full_name ?? me.email ?? '').trim();
    const result = await db.query(
      `update public.crm_forecast_blockers
       set workflow_status = 'resolved', resolved_at = now(), resolved_by_email = $2, resolved_by_name = $3,
           updated_by_email = $2, updated_by_name = $3
       where forecast_id = $1::uuid and has_blocker = true
       returning id::text`,
      [forecastId, me.email, actorName],
    );
    if (!result.rowCount) return NextResponse.json({ message: 'Çözülecek açık engel bulunamadı.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Kayıt çözüldü olarak işaretlenemedi.' }, { status: error?.status || 500 });
  }
}
