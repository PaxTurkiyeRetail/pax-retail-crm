import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { getForecastForBlockerOrThrow } from '@/lib/forecast-blocker-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const me = await requireAdminOrThrow();
    const body = await request.json().catch(() => ({}));
    const forecastId = String(body.forecast_id ?? '').trim();
    await getForecastForBlockerOrThrow(me, forecastId);
    const managerNote = String(body.manager_note ?? '').trim() || null;
    const reviewed = body.reviewed !== false;
    const actorName = String(me.full_name ?? me.email ?? '').trim();
    const result = await db.query(
      `update public.crm_forecast_blockers
       set manager_note = $2,
           reviewed_at = case when $3 then now() else null end,
           reviewed_by_email = case when $3 then $4 else null end,
           reviewed_by_name = case when $3 then $5 else null end,
           updated_by_email = $4,
           updated_by_name = $5
       where forecast_id = $1::uuid
       returning id::text`,
      [forecastId, managerNote, reviewed, me.email, actorName],
    );
    if (!result.rowCount) return NextResponse.json({ message: 'İncelenecek kullanıcı cevabı bulunamadı.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yönetim incelemesi kaydedilemedi.' }, { status: error?.status || 500 });
  }
}
