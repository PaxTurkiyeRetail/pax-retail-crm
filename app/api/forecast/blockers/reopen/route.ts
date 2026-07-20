import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { getCustomerForBlockerOrThrow } from '@/lib/forecast-blocker-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = await request.json().catch(() => ({}));
    const customerId = String(body.customer_id ?? '').trim();
    await getCustomerForBlockerOrThrow(me, customerId);
    const actorName = String(me.full_name ?? me.email ?? '').trim();
    const result = await db.query(
      `update public.crm_forecast_blockers
       set workflow_status = 'open', resolved_at = null, resolved_by_email = null, resolved_by_name = null,
           updated_by_email = $2, updated_by_name = $3
       where customer_id = $1::uuid and has_blocker = true
       returning id::text`,
      [customerId, me.email, actorName],
    );
    if (!result.rowCount) return NextResponse.json({ message: 'Yeniden açılacak kayıt bulunamadı.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Kayıt yeniden açılamadı.' }, { status: error?.status || 500 });
  }
}
