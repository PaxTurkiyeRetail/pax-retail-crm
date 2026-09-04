import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { tryRecordAuditEvent } from '@/lib/audit';
import { assertActiveParameterValue } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// İş Kolu — tek alanlı güncelleme.
//
// Neden ayrı uç: künye kartındaki rozetten tek tıkla değiştirilebilmesi için.
// /api/kunye POST tüm künye formunu upsert eder (tek alan için çağrılamaz —
// diğer alanları boşaltır), /api/crm/update ise müşteri adını zorunlu tutan tam
// kart güncellemesidir. Kayıt yeri her zaman musteriler.is_kolu (tek kaynak);
// künye view'leri bu değeri m.is_kolu'dan okur (bkz. migration 008).
export async function POST(req: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await req.json().catch(() => ({}))) as { musteriId?: unknown; is_kolu?: unknown };
    const musteriId = String(body.musteriId ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data: current, error: readError } = await admin
      .from('musteriler')
      .select('id,musteri,sorumlu,owner_user_id,is_kolu')
      .eq('id', musteriId)
      .maybeSingle();
    if (readError) return NextResponse.json({ message: readError.message }, { status: 500 });
    if (!current) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

    try {
      assertOwnedResourceAccess({ user: me, resource: current, ownPermission: 'customer.update.own', anyPermission: 'customer.update.any' });
    } catch {
      return NextResponse.json({ message: 'Müşteri bulunamadı veya erişim yetkiniz yok.' }, { status: 404 });
    }

    const isKolu = await assertActiveParameterValue('kunye_is_kolu', String(body.is_kolu ?? '').trim());

    const { error: updateError } = await admin
      .from('musteriler')
      .update({ is_kolu: isKolu, updated_at: new Date().toISOString() })
      .eq('id', musteriId);
    if (updateError) return NextResponse.json({ message: updateError.message }, { status: 400 });

    await tryRecordAuditEvent({
      actorId: me.id,
      actorEmail: me.email,
      action: 'customer.updated',
      resourceType: 'customer',
      resourceId: musteriId,
      before: { is_kolu: current.is_kolu ?? null },
      after: { is_kolu: isKolu },
    });

    revalidatePath(`/crm/${musteriId}`);
    revalidatePath('/crm/customers');

    return NextResponse.json({ ok: true, is_kolu: isKolu });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'İş Kolu güncellenemedi.' }, { status: error?.status || 400 });
  }
}
