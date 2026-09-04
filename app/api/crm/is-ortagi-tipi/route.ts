import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { tryRecordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// İş Ortağı Tipi — tek alanlı güncelleme (is_kolu ucunun aynı modeli).
const ALLOWED_VALUES = ['Entegrasyon Firması', 'Donanım Firması'];

export async function POST(req: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await req.json().catch(() => ({}))) as { musteriId?: unknown; is_ortagi_tipi?: unknown };
    const musteriId = String(body.musteriId ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const value = String(body.is_ortagi_tipi ?? '').trim();
    if (!ALLOWED_VALUES.includes(value)) {
      return NextResponse.json({ message: 'Geçersiz İş Ortağı Tipi değeri.' }, { status: 400 });
    }

    const admin = createPgAdminClient();
    const { data: current, error: readError } = await admin
      .from('musteriler')
      .select('id,musteri,sorumlu,owner_user_id,is_ortagi_tipi')
      .eq('id', musteriId)
      .maybeSingle();
    if (readError) return NextResponse.json({ message: readError.message }, { status: 500 });
    if (!current) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

    try {
      assertOwnedResourceAccess({ user: me, resource: current, ownPermission: 'customer.update.own', anyPermission: 'customer.update.any' });
    } catch {
      return NextResponse.json({ message: 'Müşteri bulunamadı veya erişim yetkiniz yok.' }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from('musteriler')
      .update({ is_ortagi_tipi: value, updated_at: new Date().toISOString() })
      .eq('id', musteriId);
    if (updateError) return NextResponse.json({ message: updateError.message }, { status: 400 });

    await tryRecordAuditEvent({
      actorId: me.id,
      actorEmail: me.email,
      action: 'customer.updated',
      resourceType: 'customer',
      resourceId: musteriId,
      before: { is_ortagi_tipi: current.is_ortagi_tipi ?? null },
      after: { is_ortagi_tipi: value },
    });

    revalidatePath(`/crm/${musteriId}`);
    revalidatePath('/crm/customers');

    return NextResponse.json({ ok: true, is_ortagi_tipi: value });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'İş Ortağı Tipi güncellenemedi.' }, { status: error?.status || 400 });
  }
}
