import { normalizeDurum } from '@/app/api/activities/_helpers';
import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type Body = {
  musteri_id?: string;
  kanal?: 'Online Toplantı' | 'Yerinde Ziyaret' | 'Telefon' | 'E-posta' | 'Diğer';
  notlar?: string | null;
  faz_no?: number | null;
  faz_durum?: 'Devam ediyor' | 'Devam Ediyor' | 'Tamamlandı' | 'İhtiyaç duyulmadı' | 'İhtiyaç Duyulmadı' | 'Başlamadı' | null;
  bekleyen_taraf?: 'Müşteri' | 'Müşteri IT' | 'Müşteri (Finance Owner)' | 'PAX RS(Support)' | null;
  plan?: {
    hedef_tarihi: string;
    hedef_aktivite?: 'Online Toplantı' | 'Yerinde Ziyaret' | 'Telefon' | 'E-posta' | 'Diğer';
    hedef_not?: string | null;
    hedef_faz_no?: number | null;
  } | null;
};

const EMPTY_WAITING_SIDE_MESSAGE = 'Bekleyen Taraf boş olamaz. Lütfen seçim yapın; eski kayıt varsa backend fallback alacaktır.';

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireAllowedUserOrThrow>>;
  try {
    me = await requireAllowedUserOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const musteri_id = String(body.musteri_id ?? '').trim();
  if (!musteri_id) return NextResponse.json({ message: 'musteri_id gerekli' }, { status: 400 });

  const created_by = (me.full_name ?? '').trim();
  if (!created_by) return NextResponse.json({ message: 'allowed_users.full_name boş olamaz' }, { status: 400 });

  const kanal = (body.kanal ?? 'Diğer') as NonNullable<Body['kanal']>;
  const notlar = (body.notlar ?? '').toString().trim() || null;
  const faz_no = body.faz_no ?? null;
  const faz_durum = normalizeDurum(body.faz_durum ?? null) as Body['faz_durum'];
  const explicitBekleyenTaraf = body.bekleyen_taraf ? String(body.bekleyen_taraf).trim() : null;
  const nextActivity = body.plan ?? null;
  if (faz_no == null) return NextResponse.json({ message: 'faz_no gerekli' }, { status: 400 });

  const admin = createSupabaseAdminClient();

  const [
    { data: latestPhaseEvent },
    { data: currentPipeline },
    { data: currentFaz },
    { data: latestPartnerFromSamePhase },
    { data: latestPartnerFromCustomer },
  ] = await Promise.all([
    admin.from('pipeline_eventleri').select('iteration_no').eq('musteri_id', musteri_id).eq('faz_no', faz_no).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('musteri_pipeline').select('musteri_id,aktif_faz_no,durum,owner,partner_owner').eq('musteri_id', musteri_id).maybeSingle(),
    admin.from('faz_tanimlari').select('owner').eq('faz_no', faz_no).maybeSingle(),
    admin
      .from('pipeline_eventleri')
      .select('partner_owner')
      .eq('musteri_id', musteri_id)
      .eq('faz_no', faz_no)
      .not('partner_owner', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('pipeline_eventleri')
      .select('partner_owner')
      .eq('musteri_id', musteri_id)
      .not('partner_owner', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const iteration_no = Number((latestPhaseEvent as any)?.iteration_no ?? 1) || 1;
  const canonicalDurum = normalizeDurum(faz_durum ?? currentPipeline?.durum ?? 'Devam Ediyor') ?? 'Devam Ediyor';
  const fazOwner = String(currentFaz?.owner ?? currentPipeline?.owner ?? '').trim() || null;
  const resolvedBekleyenTaraf = (
    explicitBekleyenTaraf ??
    currentPipeline?.partner_owner ??
    latestPartnerFromSamePhase?.partner_owner ??
    latestPartnerFromCustomer?.partner_owner ??
    null
  )?.toString().trim() || null;

  if (!resolvedBekleyenTaraf) {
    return NextResponse.json({ message: EMPTY_WAITING_SIDE_MESSAGE }, { status: 400 });
  }

  let activityUpdated = false;
  if (faz_durum === 'Tamamlandı') {
    const { data: pending } = await admin
      .from('pipeline_eventleri')
      .select('id')
      .eq('musteri_id', musteri_id)
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
        .update({ durum: 'Tamamlandı', owner: fazOwner, partner_owner: resolvedBekleyenTaraf, notlar, created_by })
        .eq('id', pending.id);
      if (updErr) return NextResponse.json({ message: updErr.message }, { status: 400 });
      activityUpdated = true;
    }
  }

  if (!activityUpdated) {
    const { error: actErr } = await admin.from('pipeline_eventleri').insert({
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
    });
    if (actErr) return NextResponse.json({ message: actErr.message }, { status: 400 });
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

  if (nextActivity && nextActivity.hedef_tarihi) {
    const hedef_tarihi = String(nextActivity.hedef_tarihi).trim();
    const hedef_aktivite = nextActivity.hedef_aktivite ? String(nextActivity.hedef_aktivite).trim() : null;
    const hedef_not = String(nextActivity.hedef_not ?? '').trim() || null;
    const hedef_faz_no = nextActivity.hedef_faz_no ?? faz_no;
    const { data: hedefFaz } = await admin.from('faz_tanimlari').select('owner').eq('faz_no', hedef_faz_no).maybeSingle();
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

  const { error: pipelineErr } = await admin.from('musteri_pipeline').upsert(pipelinePayload, { onConflict: 'musteri_id' });
  if (pipelineErr) return NextResponse.json({ message: `musteri_pipeline güncellenemedi: ${pipelineErr.message}` }, { status: 400 });

  return NextResponse.json({ ok: true, iteration_no, updated_existing: activityUpdated, pipeline: pipelinePayload });
}
