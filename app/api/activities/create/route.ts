import { normalizeDurum } from '@/lib/activities/presentation';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireActivityCreateOrThrow, userHasPermission } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { completeActivitiesForSamePhase, completePreviousOpenActivities } from '@/lib/activity-phase-completion';
import { activityScopeForChannel, affectsPhaseForChannel, isBusinessPartnerActivity, isTechnicalChannel, normalizeChannel } from '@/lib/activity-channels';
import { assertActiveParameterValue } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ActivityKanal = 'Online Toplantı' | 'Yerinde Ziyaret' | 'Telefon' | 'E-posta' | 'Teknik Ziyaret' | 'Teknik Online' | 'POM' | 'İş Ortaklığı Aktivitesi' | 'Diğer';
type ActivityDurum = 'Devam Ediyor' | 'Tamamlandı' | 'İhtiyaç Duyulmadı' | 'Başlamadı' | 'Bekleniyor' | null;
type WaitingSide = string | null;

type Body = {
  technical_contact_id?: string | null;
  activity_context?: 'customer' | 'business_partner';
  activity_id?: string | null;
  musteri_id?: string;
  kanal?: ActivityKanal;
  event_type?: ActivityKanal;
  notlar?: string | null;
  faz_no?: number | null;
  faz_durum?: ActivityDurum;
  durum?: ActivityDurum;
  bekleyen_taraf?: WaitingSide;
  bekleyenTaraf?: WaitingSide;
  partner_owner?: WaitingSide;
  aksiyon?: WaitingSide;
  plan?: {
    hedef_tarihi: string;
    hedef_aktivite?: ActivityKanal;
    hedef_not?: string | null;
    hedef_faz_no?: number | null;
  } | null;
  plan_enabled?: boolean;
  plan_tarih?: string | null;
  plan_aktivite?: ActivityKanal | null;
  plan_not?: string | null;
  plan_hedef_faz_no?: number | null;
};

const EMPTY_WAITING_SIDE_MESSAGE = 'Bekleyen Taraf boş olamaz. Lütfen seçim yapın; eski kayıt varsa backend fallback alacaktır.';
const TECHNICAL_PHASE_REQUIRED_MESSAGE = 'Bu müşteri için faz bilgisi bulunamadı. Lütfen önce account ekibine bilgi veriniz; teknik aktivite girebilmek için müşterinin faz bilgisi olmalıdır.';
const BUSINESS_PARTNER_PHASE_REQUIRED_MESSAGE = 'Bu iş ortağı için faz bulunamadı. Accountlara haber veriniz.';
function isMeaningfulPhaseStatus(value: string | null | undefined) {
  const normalized = normalizeDurum(value as ActivityDurum);
  return Boolean(normalized && normalized !== 'Başlamadı');
}

async function getTechnicalPhaseSnapshot(admin: any, musteri_id: string) {
  const { data: pipeline } = await admin
    .from('musteri_pipeline')
    .select('musteri_id,aktif_faz_no,durum,owner,partner_owner,updated_at')
    .eq('musteri_id', musteri_id)
    .maybeSingle();

  if (pipeline?.aktif_faz_no != null) {
    return {
      faz_no: Number(pipeline.aktif_faz_no),
      durum: normalizeDurum(pipeline.durum as ActivityDurum) ?? 'Devam Ediyor',
      owner: String(pipeline.owner ?? '').trim() || null,
      partner_owner: String(pipeline.partner_owner ?? '').trim() || null,
    };
  }

  const { data: events } = await admin
    .from('pipeline_eventleri')
    .select('faz_no,durum,owner,partner_owner,created_at')
    .eq('musteri_id', musteri_id)
    .not('faz_no', 'is', null)
    .not('durum', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);

  const latest = (events ?? []).find((row: any) => row?.faz_no != null && isMeaningfulPhaseStatus(row?.durum));
  if (!latest) return null;

  return {
    faz_no: Number(latest.faz_no),
    durum: normalizeDurum(latest.durum as ActivityDurum) ?? 'Devam Ediyor',
    owner: String(latest.owner ?? '').trim() || null,
    partner_owner: String(latest.partner_owner ?? '').trim() || null,
  };
}

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireActivityCreateOrThrow>>;
  try {
    me = await requireActivityCreateOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const activity_id = String(body.activity_id ?? '').trim() || null;
  const musteri_id = String(body.musteri_id ?? '').trim();
  if (!musteri_id) return NextResponse.json({ message: 'musteri_id gerekli' }, { status: 400 });

  const created_by = String(me.full_name ?? me.email ?? '').trim();
  if (!created_by) return NextResponse.json({ message: 'Kullanıcı kimliği bulunamadı' }, { status: 400 });
  const created_by_user_id = me.id;
  const created_by_email = me.email;

  const kanal = normalizeChannel((body.kanal ?? body.event_type ?? 'Diğer') as string) as ActivityKanal;
  const isTechnicalActivity = isTechnicalChannel(kanal);
  const partnerActivity = isBusinessPartnerActivity(kanal);
  const canCreateTechnical = userHasPermission(me, 'activity.technical.create');

  if (isTechnicalActivity && !canCreateTechnical) {
    return NextResponse.json(
      { message: 'Teknik Ziyaret, Teknik Online ve POM aktivitelerini sadece ITSM, admin veya super admin kullanıcıları girebilir.' },
      { status: 403 }
    );
  }

  if (partnerActivity && me.role !== 'super_admin') {
    const { data: typeAccess, error: typeAccessError } = await createPgAdminClient().from('activity_type_role_permissions')
      .select('can_create,can_change_phase').eq('activity_type_key', 'business_partner_activity').eq('role_key', me.role).maybeSingle();
    if (typeAccessError || !typeAccess?.can_create || !typeAccess?.can_change_phase) {
      return NextResponse.json({ message: 'İş Ortaklığı Aktivitesi oluşturma ve faz değiştirme yetkiniz yok.' }, { status: 403 });
    }
  }

  const activity_scope = activityScopeForChannel(kanal);
  let affects_phase = affectsPhaseForChannel(kanal);
  const notlar = (body.notlar ?? '').toString().trim() || null;
  const requestedFazNo = body.faz_no ?? null;
  const faz_durum = normalizeDurum((body.faz_durum ?? body.durum ?? null) as ActivityDurum) as ActivityDurum;
  const explicitBekleyenTarafRaw =
    body.bekleyen_taraf ??
    body.bekleyenTaraf ??
    body.partner_owner ??
    body.aksiyon ??
    null;
  const explicitBekleyenTaraf = explicitBekleyenTarafRaw ? String(explicitBekleyenTarafRaw).trim() : null;
  try {
    await assertActiveParameterValue('activity_waiting_party', explicitBekleyenTaraf, { optional: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Geçersiz bekleyen taraf.' }, { status: error?.status || 400 });
  }

  const requestedNextActivity = body.plan ?? (
    body.plan_enabled && body.plan_tarih
      ? {
          hedef_tarihi: String(body.plan_tarih).trim(),
          hedef_aktivite: (body.plan_aktivite ?? 'Diğer') as ActivityKanal,
          hedef_not: String(body.plan_not ?? '').trim() || null,
          hedef_faz_no: body.plan_hedef_faz_no ?? requestedFazNo,
        }
      : null
  );
  let nextActivity = affects_phase ? requestedNextActivity : null;

  const admin = createPgAdminClient();

  const { data: customer } = await admin
    .from('musteriler')
    .select('id,musteri,sorumlu,sektor,owner_user_id,customer_type,pipeline_policy')
    .eq('id', musteri_id)
    .maybeSingle();

  if (!customer?.id) {
    return NextResponse.json({ message: 'Müşteri bulunamadı' }, { status: 404 });
  }

  let existingContactId: string | null = null;
  let existingActivityContext: 'customer' | 'business_partner' | null = null;
  if (activity_id) {
    const { data: existing, error: existingError } = await admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,created_by_user_id,created_by_email,created_by,activity_scope,activity_context,technical_contact_id')
      .eq('id', activity_id)
      .eq('musteri_id', musteri_id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ message: 'Aktivite kontrol edilemedi.' }, { status: 500 });
    if (!existing?.id) return NextResponse.json({ message: 'Bu firmaya ait aktivite bulunamadı.' }, { status: 404 });
    existingContactId = existing.technical_contact_id ?? null;
    existingActivityContext = existing.activity_context === 'business_partner' ? 'business_partner' : existing.activity_context === 'customer' ? 'customer' : null;
    try {
      assertOwnedResourceAccess({
        user: me,
        resource: { owner_user_id: existing.created_by_user_id, owner_email: existing.created_by_email, owner_name: existing.created_by },
        ownPermission: 'activity.update.own',
        anyPermission: 'activity.update.any',
      });
    } catch (error: any) {
      return NextResponse.json({ message: 'Bu aktiviteyi düzenleme yetkiniz yok.' }, { status: error?.status || 403 });
    }
    if (existing.activity_scope === 'technical' && !canCreateTechnical) {
      return NextResponse.json({ message: 'Teknik aktiviteyi düzenleme yetkiniz yok.' }, { status: 403 });
    }
  }

  if (!userHasPermission(me, 'activity.read.any') && !userHasPermission(me, 'customer.read.any') && String(customer.owner_user_id ?? '') !== me.id) {
    return NextResponse.json({ message: 'Bu müşteri için aktivite oluşturma yetkiniz yok.' }, { status: 403 });
  }

  const isBusinessPartnerCustomer = String(customer.customer_type ?? 'standard') === 'business_partner';
  const { data: relationships, error: relationshipError } = await admin.from('organization_roles')
    .select('role_key,is_active').eq('customer_id', musteri_id).eq('is_active', true);
  if (relationshipError) return NextResponse.json({ message: 'Firma ilişkileri kontrol edilemedi.' }, { status: 503 });
  const relationshipKeys = new Set((relationships ?? []).map((row: any) => String(row.role_key)));
  const activity_context: 'customer' | 'business_partner' = partnerActivity || existingActivityContext === 'business_partner' || (isBusinessPartnerCustomer && !relationshipKeys.has('customer')) ? 'business_partner' : 'customer';
  if (!relationshipKeys.has(activity_context)) return NextResponse.json({ message: activity_context === 'business_partner' ? 'Bu firmada aktif İş Ortağı ilişkisi yok.' : 'Bu firmada aktif Müşteri ilişkisi yok.' }, { status: 400 });
  const syncLegacyPipeline = activity_context === 'customer' || !relationshipKeys.has('customer');
  const contactPatch: { technical_contact_id?: string | null } = {};
  if (body.technical_contact_id !== undefined) {
    const contactId = body.technical_contact_id;
    if (contactId !== null) {
      if (typeof contactId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId)) {
        return NextResponse.json({ message: 'Geçersiz teknik yetkili.' }, { status: 400 });
      }
      const { data: contact, error: contactError } = await admin.from('customer_technical_contacts')
        .select('id,is_active').eq('id', contactId).eq('customer_id', musteri_id).maybeSingle();
      if (contactError) return NextResponse.json({ message: 'Teknik yetkili kontrol edilemedi.' }, { status: 503 });
      if (!contact || (!contact.is_active && contact.id !== existingContactId)) {
        return NextResponse.json({ message: 'Bu firmaya ait aktif bir teknik yetkili seçin.' }, { status: 400 });
      }
    }
    contactPatch.technical_contact_id = contactId;
  }
  const phaseOptionalCustomer = !partnerActivity && String(customer.pipeline_policy ?? 'phase_required') === 'phase_optional';
  if (phaseOptionalCustomer) {
    affects_phase = false;
    nextActivity = null;
  }
  const technicalSnapshot = isTechnicalActivity ? await getTechnicalPhaseSnapshot(admin, musteri_id) : null;

  if (!isTechnicalActivity && !phaseOptionalCustomer && requestedFazNo == null) return NextResponse.json({ message: 'faz_no gerekli' }, { status: 400 });

  if (isTechnicalActivity && !phaseOptionalCustomer && !technicalSnapshot?.faz_no) {
    return NextResponse.json({ message: isBusinessPartnerCustomer ? BUSINESS_PARTNER_PHASE_REQUIRED_MESSAGE : TECHNICAL_PHASE_REQUIRED_MESSAGE }, { status: 400 });
  }

  const faz_no = phaseOptionalCustomer
    ? null
    : (isTechnicalActivity
      ? (technicalSnapshot?.faz_no != null ? Number(technicalSnapshot.faz_no) : null)
      : Number(requestedFazNo));

  const [
    { data: latestPhaseEvent },
    { data: currentPipeline },
    { data: currentFaz },
    { data: latestPartnerFromSamePhase },
    { data: latestPartnerFromCustomer },
  ] = await Promise.all([
    faz_no != null
      ? admin.from('pipeline_eventleri').select('iteration_no').eq('musteri_id', musteri_id).eq('activity_context', activity_context).eq('faz_no', faz_no).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    activity_context === 'business_partner'
      ? admin.from('organization_pipeline_states').select('customer_id,active_phase_no,status,owner,partner_owner').eq('customer_id', musteri_id).eq('context_key', activity_context).maybeSingle()
      : admin.from('musteri_pipeline').select('musteri_id,aktif_faz_no,durum,owner,partner_owner').eq('musteri_id', musteri_id).maybeSingle(),
    faz_no != null
      ? admin.from(activity_context === 'business_partner' ? 'is_ortagi_faz_tanimlari' : 'faz_tanimlari').select('owner').eq('faz_no', faz_no).maybeSingle()
      : Promise.resolve({ data: null }),
    faz_no != null
      ? admin.from('pipeline_eventleri').select('partner_owner').eq('musteri_id', musteri_id).eq('activity_context', activity_context).eq('faz_no', faz_no).not('partner_owner', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('pipeline_eventleri').select('partner_owner').eq('musteri_id', musteri_id).eq('activity_context', activity_context).not('partner_owner', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const iteration_no = Number((latestPhaseEvent as any)?.iteration_no ?? 1) || 1;
  const currentPipelineStatus = currentPipeline?.status ?? currentPipeline?.durum;
  const canonicalDurum = isTechnicalActivity
    ? (normalizeDurum(technicalSnapshot?.durum as ActivityDurum) ?? normalizeDurum(currentPipelineStatus as ActivityDurum) ?? 'Devam Ediyor')
    : (normalizeDurum(faz_durum ?? currentPipelineStatus ?? 'Devam Ediyor') ?? 'Devam Ediyor');
  const fazOwner = String((isTechnicalActivity ? technicalSnapshot?.owner : null) ?? currentFaz?.owner ?? currentPipeline?.owner ?? customer.sorumlu ?? '').trim() || null;
  const resolvedBekleyenTarafRaw = isTechnicalActivity
    ? (technicalSnapshot?.partner_owner ?? currentPipeline?.partner_owner ?? latestPartnerFromSamePhase?.partner_owner ?? latestPartnerFromCustomer?.partner_owner ?? (phaseOptionalCustomer ? customer.sorumlu : null))
    : (explicitBekleyenTaraf ?? currentPipeline?.partner_owner ?? latestPartnerFromSamePhase?.partner_owner ?? latestPartnerFromCustomer?.partner_owner ?? (phaseOptionalCustomer ? customer.sorumlu : null));
  const resolvedBekleyenTaraf = resolvedBekleyenTarafRaw ? String(resolvedBekleyenTarafRaw).trim() : null;

  if (!resolvedBekleyenTaraf && !phaseOptionalCustomer) {
    return NextResponse.json({ message: EMPTY_WAITING_SIDE_MESSAGE, debug: { receivedKeys: Object.keys(body || {}) } }, { status: 400 });
  }

  let activityUpdated = false;

  if (activity_id) {
    const targetId = String(activity_id).trim();
    const { data: existing } = await admin
      .from('pipeline_eventleri')
      .select('id,musteri_id,faz_no,activity_scope,affects_phase')
      .eq('id', targetId)
      .maybeSingle();

    if (!existing?.id) {
      return NextResponse.json({ message: 'Düzenlenecek aktivite bulunamadı' }, { status: 404 });
    }

    const { error: editErr } = await admin
      .from('pipeline_eventleri')
      .update({
        ...contactPatch,
        faz_no,
        durum: canonicalDurum,
        aksiyon: `AKTIVITE:${kanal}`,
        owner: fazOwner,
        partner_owner: resolvedBekleyenTaraf,
        notlar,
        updated_by_user_id: created_by_user_id,
        updated_by_email: created_by_email,
        updated_at: new Date().toISOString(),
        activity_scope,
        affects_phase,
        activity_context,
      })
      .eq('id', targetId)
      .eq('musteri_id', musteri_id);
    if (editErr) return NextResponse.json({ message: editErr.message }, { status: 400 });

    if (affects_phase && canonicalDurum === 'Tamamlandı') {
      try {
        await completeActivitiesForSamePhase({
          musteri_id,
          faz_no: Number(faz_no),
          actor: created_by,
          actor_user_id: created_by_user_id,
          actor_email: created_by_email,
          owner: fazOwner,
          partner_owner: resolvedBekleyenTaraf,
          notlar,
          exclude_id: targetId,
          activity_context,
          sync_legacy_pipeline: syncLegacyPipeline,
        });
      } catch (e: any) {
        return NextResponse.json({ message: e?.message || 'Aynı faz aktiviteleri tamamlanamadı' }, { status: 400 });
      }
    }
    activityUpdated = true;
  }

  if (affects_phase && !activityUpdated && faz_durum === 'Tamamlandı') {
    const { data: pending } = await admin
      .from('pipeline_eventleri')
      .select('id')
      .eq('musteri_id', musteri_id)
      .eq('activity_context', activity_context)
      .eq('faz_no', faz_no)
      .eq('durum', 'Başlamadı')
      .eq('aksiyon', `AKTIVITE:${kanal}`)
      .order('hedef_tarihi', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.id) {
      const { error: updErr } = await admin
        .from('pipeline_eventleri')
        .update({ ...contactPatch, durum: 'Tamamlandı', owner: fazOwner, partner_owner: resolvedBekleyenTaraf, notlar, updated_by_user_id: created_by_user_id, updated_by_email: created_by_email, updated_at: new Date().toISOString(), activity_scope, affects_phase, activity_context })
        .eq('id', pending.id);
      if (updErr) return NextResponse.json({ message: updErr.message }, { status: 400 });

      try {
        await completeActivitiesForSamePhase({
          musteri_id,
          faz_no: Number(faz_no),
          actor: created_by,
          actor_user_id: created_by_user_id,
          actor_email: created_by_email,
          owner: fazOwner,
          partner_owner: resolvedBekleyenTaraf,
          notlar,
          exclude_id: pending.id,
          activity_context,
          sync_legacy_pipeline: syncLegacyPipeline,
        });
      } catch (e: any) {
        return NextResponse.json({ message: e?.message || 'Aynı faz aktiviteleri tamamlanamadı' }, { status: 400 });
      }

      activityUpdated = true;
    }
  }

  if (!activityUpdated) {
    const { data: inserted, error: actErr } = await admin.from('pipeline_eventleri').insert({
      ...contactPatch,
      musteri_id,
      faz_no,
      iteration_no,
      event_type: 'note_added',
      durum: canonicalDurum,
      aksiyon: `AKTIVITE:${kanal}`,
      owner: fazOwner,
      partner_owner: resolvedBekleyenTaraf,
      baslangic_tarihi: null,
      hedef_tarihi: null,
      notlar,
      created_by,
      created_by_user_id,
      created_by_email,
      activity_scope,
      affects_phase,
      activity_context,
    }).select('id').single();
    if (actErr) return NextResponse.json({ message: actErr.message }, { status: 400 });

    if (affects_phase && canonicalDurum === 'Tamamlandı') {
      try {
        await completeActivitiesForSamePhase({
          musteri_id,
          faz_no: Number(faz_no),
          actor: created_by,
          actor_user_id: created_by_user_id,
          actor_email: created_by_email,
          owner: fazOwner,
          partner_owner: resolvedBekleyenTaraf,
          notlar,
          exclude_id: String((inserted as any)?.id ?? '').trim() || null,
          activity_context,
          sync_legacy_pipeline: syncLegacyPipeline,
        });
      } catch (e: any) {
        return NextResponse.json({ message: e?.message || 'Aynı faz aktiviteleri tamamlanamadı' }, { status: 400 });
      }
    }
  }

  let pipelinePayload = {
    musteri_id,
    aktif_faz_no: faz_no,
    durum: canonicalDurum,
    owner: fazOwner,
    partner_owner: resolvedBekleyenTaraf,
    hedef_tarihi: null as string | null,
    updated_at: new Date().toISOString(),
  };

  if (affects_phase && nextActivity && nextActivity.hedef_tarihi) {
    const hedef_tarihi = String(nextActivity.hedef_tarihi).trim();
    const hedef_aktivite = nextActivity.hedef_aktivite ? String(nextActivity.hedef_aktivite).trim() : null;
    const hedef_faz_no = Number(nextActivity.hedef_faz_no ?? faz_no);

    if (isTechnicalChannel(hedef_aktivite)) {
      return NextResponse.json({ message: 'Sonraki aksiyon olarak Teknik Ziyaret, Teknik Online veya POM planlanamaz. Teknik aktiviteler ITSM tarafından mevcut faz üstünden girilmelidir.' }, { status: 400 });
    }
    if (isBusinessPartnerActivity(hedef_aktivite)) {
      return NextResponse.json({ message: 'İş Ortaklığı Aktivitesi sonraki aksiyon olarak planlanamaz; ilgili iş ortağı sürecinden ayrı kayıt açın.' }, { status: 400 });
    }

    const hedef_not = String(nextActivity.hedef_not ?? '').trim() || null;
    const { data: hedefFaz } = await admin.from(activity_context === 'business_partner' ? 'is_ortagi_faz_tanimlari' : 'faz_tanimlari').select('owner').eq('faz_no', hedef_faz_no).maybeSingle();
    const nextOwner = String(hedefFaz?.owner ?? fazOwner ?? '').trim() || null;

    const { error: nErr } = await admin.from('pipeline_eventleri').insert({
      musteri_id,
      faz_no: hedef_faz_no,
      iteration_no,
      event_type: 'note_added',
      durum: 'Başlamadı',
      aksiyon: hedef_aktivite ? `AKTIVITE:${hedef_aktivite}` : 'AKTIVITE:Diğer',
      owner: nextOwner,
      partner_owner: resolvedBekleyenTaraf,
      baslangic_tarihi: null,
      hedef_tarihi,
      notlar: hedef_not,
      created_by,
      created_by_user_id,
      created_by_email,
      activity_scope: 'account',
      affects_phase: true,
      activity_context,
    });
    if (nErr) return NextResponse.json({ message: nErr.message }, { status: 400 });

    pipelinePayload = {
      musteri_id,
      aktif_faz_no: hedef_faz_no,
      durum: 'Başlamadı',
      owner: nextOwner,
      partner_owner: resolvedBekleyenTaraf,
      hedef_tarihi,
      updated_at: new Date().toISOString(),
    };
  }

  if (affects_phase && canonicalDurum === 'Tamamlandı') {
    try {
      await completePreviousOpenActivities({
        musteri_id,
        faz_no: Number(faz_no),
        actor: created_by,
        actor_user_id: created_by_user_id,
        actor_email: created_by_email,
        owner: fazOwner,
        partner_owner: resolvedBekleyenTaraf,
        activity_context,
        sync_legacy_pipeline: syncLegacyPipeline,
      });
    } catch (e: any) {
      return NextResponse.json({ message: e?.message || 'Önceki açık faz aktiviteleri tamamlanamadı' }, { status: 400 });
    }
  }

  if (affects_phase && syncLegacyPipeline) {
    const { error: pipelineErr } = await admin.from('musteri_pipeline').upsert(pipelinePayload, { onConflict: 'musteri_id' });
    if (pipelineErr) return NextResponse.json({ message: `musteri_pipeline güncellenemedi: ${pipelineErr.message}` }, { status: 400 });
  }

  revalidatePath('/crm/activities');
  return NextResponse.json({ ok: true, iteration_no, updated_existing: activityUpdated, pipeline: affects_phase ? pipelinePayload : null, activity_scope, activity_context, affects_phase });
}
