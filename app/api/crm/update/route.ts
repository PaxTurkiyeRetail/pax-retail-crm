import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireCrmAccessOrThrow, userHasPermission } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { HAVUZ_ACCOUNT_NAME, LEGACY_INTEGRATION_ENUM_VALUES } from '@/lib/crm';
import { tryRecordAuditEvent } from '@/lib/audit';
import { assertActiveParameterValue } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  musteriId?: string;
  musteri?: string;
  sektor?: string | null;
  entegrasyon_tipi?: string | null;
  satis_olasiligi?: string | null;
  sorumlu?: string | null;
  owner_user_id?: string | null;
  customer_type?: string | null;
  pipeline_policy?: string | null;
};

const legacyIntegrationValues = new Set<string>(LEGACY_INTEGRATION_ENUM_VALUES);

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireCrmAccessOrThrow>>;
  try {
    me = await requireCrmAccessOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const musteriId = String(body.musteriId ?? '').trim();
  if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

  const musteri = String(body.musteri ?? '').trim();
  if (!musteri) return NextResponse.json({ message: 'musteri gerekli' }, { status: 400 });

  const sektor = body.sektor ? String(body.sektor).trim() : null;
  const entegrasyon_tipi = body.entegrasyon_tipi ? String(body.entegrasyon_tipi).trim() : null;
  const satis_olasiligi = body.satis_olasiligi ? String(body.satis_olasiligi).trim() : null;
  const sorumlu = body.sorumlu ? String(body.sorumlu).trim() : null;

  const admin = createPgAdminClient();
  const { data: currentRow, error: currentRowError } = await admin
    .from('musteriler')
    .select('id,musteri,sorumlu,owner_user_id,sektor,entegrasyon_tipi,integration_type_key,satis_olasiligi,customer_type,pipeline_policy')
    .eq('id', musteriId)
    .maybeSingle();

  if (currentRowError) return NextResponse.json({ message: currentRowError.message }, { status: 500 });
  if (!currentRow) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });
  try {
    assertOwnedResourceAccess({ user: me, resource: currentRow, ownPermission: 'customer.update.own', anyPermission: 'customer.update.any' });
  } catch {
    return NextResponse.json({ message: 'Müşteri bulunamadı veya erişim yetkiniz yok.' }, { status: 404 });
  }

  const currentIntegration = String(currentRow.integration_type_key ?? currentRow.entegrasyon_tipi ?? '').trim() || null;
  try {
    await Promise.all([
      sektor !== (currentRow.sektor ?? null)
        ? assertActiveParameterValue('crm_sector', sektor, { optional: true })
        : Promise.resolve(sektor),
      entegrasyon_tipi !== currentIntegration
        ? assertActiveParameterValue('crm_integration_type', entegrasyon_tipi, { optional: true })
        : Promise.resolve(entegrasyon_tipi),
      satis_olasiligi !== (currentRow.satis_olasiligi ?? null)
        ? assertActiveParameterValue('crm_sales_probability', satis_olasiligi, { optional: true })
        : Promise.resolve(satis_olasiligi),
    ]);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Geçersiz ana veri değeri.' }, { status: error?.status || 400 });
  }

  // Sorumlu değişikliğinde aktif kullanıcı listesiyle engelleme yapmıyoruz.
  // CRM ekranındaki mevcut/filtrelenmiş sorumlu isimleri veya manuel taşınmış hesaplar kaydedilebilir.

  const requestedOwner = sorumlu || String(currentRow.sorumlu ?? "").trim() || null;
  const ownerIdWasProvided = Object.prototype.hasOwnProperty.call(body, 'owner_user_id');
  const requestedOwnerUserId = String(body.owner_user_id ?? '').trim() || null;
  let ownerUserId = currentRow.owner_user_id ? String(currentRow.owner_user_id) : null;
  let resolvedOwner = requestedOwner;
  if (ownerIdWasProvided && requestedOwnerUserId !== ownerUserId) {
    if (!userHasPermission(me, 'customer.assign')) return NextResponse.json({ message: 'Müşteri sorumlusunu değiştirme yetkiniz yok.' }, { status: 403 });
    if (!requestedOwnerUserId) {
      ownerUserId = null;
      resolvedOwner = HAVUZ_ACCOUNT_NAME;
    } else {
      const { data: ownerUser, error: ownerError } = await admin
        .from('allowed_users')
        .select('id,full_name,email')
        .eq('is_active', true)
        .eq('id', requestedOwnerUserId)
        .maybeSingle();
      if (ownerError) return NextResponse.json({ message: ownerError.message }, { status: 500 });
      if (!ownerUser) return NextResponse.json({ message: 'Sorumlu aktif bir kullanıcı olmalıdır.' }, { status: 400 });
      ownerUserId = String(ownerUser.id);
      resolvedOwner = String(ownerUser.full_name ?? ownerUser.email ?? '').trim();
    }
  } else if (!ownerIdWasProvided && requestedOwner !== String(currentRow.sorumlu ?? '').trim()) {
    // Eski istemci uyumluluğu; yeni UI owner_user_id gönderir.
    if (!userHasPermission(me, 'customer.assign')) return NextResponse.json({ message: 'Müşteri sorumlusunu değiştirme yetkiniz yok.' }, { status: 403 });
    if (requestedOwner === HAVUZ_ACCOUNT_NAME || !requestedOwner) {
      ownerUserId = null;
      resolvedOwner = HAVUZ_ACCOUNT_NAME;
    } else {
      const { data: ownerUser, error: ownerError } = await admin.from('allowed_users').select('id,full_name,email').eq('is_active', true).or(`full_name.eq.${requestedOwner},email.eq.${requestedOwner}`).limit(1).maybeSingle();
      if (ownerError) return NextResponse.json({ message: ownerError.message }, { status: 500 });
      if (!ownerUser) return NextResponse.json({ message: 'Sorumlu aktif bir kullanıcı olmalıdır.' }, { status: 400 });
      ownerUserId = String(ownerUser.id);
      resolvedOwner = String(ownerUser.full_name ?? ownerUser.email ?? '').trim();
    }
  }
  const actorName = String(me.full_name ?? me.email ?? "").trim() || null;
  let customerType = String(currentRow.customer_type ?? 'standard');
  let pipelinePolicy = String(currentRow.pipeline_policy ?? 'phase_required');
  const requestedCustomerType = String(body.customer_type ?? customerType).trim() || customerType;
  const requestedPipelinePolicy = String(body.pipeline_policy ?? pipelinePolicy).trim() || pipelinePolicy;
  if (requestedCustomerType !== customerType || requestedPipelinePolicy !== pipelinePolicy) {
    if (!userHasPermission(me, 'customer.classification.manage')) {
      return NextResponse.json({ message: 'Müşteri tipi veya pipeline politikası değiştirme yetkiniz yok.' }, { status: 403 });
    }
    try {
      customerType = await assertActiveParameterValue('crm_customer_type', requestedCustomerType);
      pipelinePolicy = await assertActiveParameterValue('crm_pipeline_policy', requestedPipelinePolicy);
    } catch (error: any) {
      return NextResponse.json({ message: error?.message || 'Geçersiz müşteri politikası.' }, { status: error?.status || 400 });
    }
  }

  const { error } = await admin
    .from('musteriler')
    .update({
      musteri,
      sektor,
      entegrasyon_tipi: entegrasyon_tipi && legacyIntegrationValues.has(entegrasyon_tipi) ? entegrasyon_tipi : null,
      integration_type_key: entegrasyon_tipi,
      satis_olasiligi,
      sorumlu: resolvedOwner,
      owner_user_id: ownerUserId,
      customer_type: customerType,
      pipeline_policy: pipelinePolicy,
      updated_by: actorName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', musteriId);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await tryRecordAuditEvent({ actorId: me.id, actorEmail: me.email, action: 'customer.updated', resourceType: 'customer', resourceId: musteriId, before: currentRow, after: { musteri, sektor, entegrasyon_tipi, satis_olasiligi, sorumlu: resolvedOwner, owner_user_id: ownerUserId, customer_type: customerType, pipeline_policy: pipelinePolicy } });
  revalidatePath('/crm/customers');
  return NextResponse.json({ ok: true, message: 'Müşteri kaydı güncellendi.' });
}
