export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requirePermissionOrThrow } from '@/lib/authz';
import { tryRecordAuditEvent } from '@/lib/audit';
import { createPgAdminClient } from '@/lib/pg/admin';

type Body = { sale_id?: string; cancel_reason?: string | null; reopen?: boolean };

// Satış iptali / geri alma. Kayıt SİLİNMEZ; status='cancelled' ciroya girmez.
export async function POST(request: Request) {
  try {
    const me = await requirePermissionOrThrow('quote.read');
    const body = (await request.json().catch(() => ({}))) as Body;
    const saleId = String(body.sale_id ?? '').trim();
    const reopen = body.reopen === true;
    const reason = String(body.cancel_reason ?? '').trim();
    if (!saleId) return NextResponse.json({ message: 'sale_id gerekli' }, { status: 400 });
    if (!reopen && !reason) return NextResponse.json({ message: 'İptal nedeni zorunlu.' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data: sale } = await admin
      .from('crm_sales')
      .select('id,owner_user_id,owner_name,status')
      .eq('id', saleId)
      .maybeSingle();
    if (!sale) return NextResponse.json({ message: 'Satış kaydı bulunamadı.' }, { status: 404 });
    assertOwnedResourceAccess({ user: me, resource: sale, ownPermission: 'quote.status.own', anyPermission: 'quote.status.any' });

    const actor = String(me.full_name ?? me.email ?? '').trim() || null;
    const payload = reopen
      ? { status: 'active', cancel_reason: null, cancelled_at: null, cancelled_by: null, updated_by: actor }
      : { status: 'cancelled', cancel_reason: reason, cancelled_at: new Date().toISOString(), cancelled_by: actor, updated_by: actor };

    const { error } = await admin.from('crm_sales').update(payload).eq('id', saleId);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    await tryRecordAuditEvent({
      actorId: me.id, actorEmail: me.email, action: reopen ? 'sale.reopened' : 'sale.cancelled',
      resourceType: 'sale', resourceId: saleId, before: { status: (sale as any).status }, after: payload,
    });

    revalidatePath('/crm/sales');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
