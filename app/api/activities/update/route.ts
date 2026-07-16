import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { canCreateTechnicalActivities } from '@/lib/roles';
import { createPgAdminClient } from '@/lib/pg/admin';
import { normalizeDurum } from '@/app/api/activities/_helpers';
import { completeActivitiesForSamePhase } from '@/lib/activity-phase-completion';
import { activityScopeForChannel, affectsPhaseForChannel, isTechnicalChannel } from '@/lib/activity-channels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  activity_id?: string;
  activity_label?: string | null;
  activity_status?: string | null;
  notlar?: string | null;
  partner_owner?: string | null;
  due_date?: string | null;
};

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireAllowedUserOrThrow>>;
  try {
    me = await requireAllowedUserOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }

  const actor = String(me.full_name ?? me.email ?? '').trim();
  if (!actor) return NextResponse.json({ message: 'Kullanıcı kimliği bulunamadı' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const activity_id = String(body.activity_id ?? '').trim();
  if (!activity_id) return NextResponse.json({ message: 'activity_id gerekli' }, { status: 400 });

  const admin = createPgAdminClient();
  const { data: found, error: foundErr } = await admin
    .from('pipeline_eventleri')
    .select('id,musteri_id,faz_no,owner,durum,created_by,aksiyon,partner_owner,notlar,hedef_tarihi,activity_scope,affects_phase')
    .eq('id', activity_id)
    .single();

  if (foundErr || !found) {
    return NextResponse.json({ message: foundErr?.message || 'Aktivite bulunamadı' }, { status: 404 });
  }

  const payload: Record<string, unknown> = {};

  if (typeof body.activity_label === 'string') {
    const label = body.activity_label.trim();
    if (label && isTechnicalChannel(label) && !canCreateTechnicalActivities(me.role)) {
      return NextResponse.json({ message: 'Teknik Ziyaret, Teknik Online ve POM aktivitelerini sadece ITSM, admin veya super admin kullanıcıları güncelleyebilir.' }, { status: 403 });
    }
    payload.aksiyon = label ? `AKTIVITE:${label}` : (found as any).aksiyon ?? 'AKTIVITE:Diğer';
    payload.activity_scope = activityScopeForChannel(label);
    payload.affects_phase = affectsPhaseForChannel(label);
  }

  if (body.activity_status !== undefined) {
    const nextStatus = normalizeDurum(body.activity_status);
    if (!nextStatus) {
      return NextResponse.json({ message: 'Geçersiz faz durumu' }, { status: 400 });
    }
    payload.durum = nextStatus;
  }

  if (body.notlar !== undefined) {
    const note = String(body.notlar ?? '').trim();
    payload.notlar = note || null;
  }

  if (body.partner_owner !== undefined) {
    const partner = String(body.partner_owner ?? '').trim();
    payload.partner_owner = partner || null;
  }

  if (body.due_date !== undefined) {
    const due = String(body.due_date ?? '').trim();
    payload.hedef_tarihi = due || null;
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ message: 'Güncellenecek alan yok' }, { status: 400 });
  }

  payload.updated_by_user_id = me.id;
  payload.updated_by_email = me.email;
  payload.updated_at = new Date().toISOString();

  const { error: updateErr } = await admin.from('pipeline_eventleri').update(payload).eq('id', activity_id);
  if (updateErr) return NextResponse.json({ message: updateErr.message }, { status: 400 });

  const finalAffectsPhase = ((payload.affects_phase as boolean | undefined) ?? (found as any).affects_phase) !== false;

  if (payload.durum === 'Tamamlandı' && finalAffectsPhase) {
    try {
      const existingOwner = String((found as any).owner ?? '').trim() || null;
      const existingPartner = String((found as any).partner_owner ?? '').trim() || null;
      const existingNote = String((found as any).notlar ?? '').trim() || null;
      await completeActivitiesForSamePhase({
        musteri_id: String((found as any).musteri_id ?? '').trim(),
        faz_no: Number((found as any).faz_no),
        actor,
        actor_user_id: me.id,
        actor_email: me.email,
        owner: (payload.owner as string | null | undefined) ?? existingOwner,
        partner_owner: (payload.partner_owner as string | null | undefined) ?? existingPartner,
        notlar: (payload.notlar as string | null | undefined) ?? existingNote,
        exclude_id: activity_id,
      });
    } catch (e: any) {
      return NextResponse.json({ message: e?.message || 'Aynı faz aktiviteleri tamamlanamadı' }, { status: 400 });
    }
  }

  revalidatePath('/crm/activities');
  return NextResponse.json({ ok: true });
}
