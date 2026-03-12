import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeDurum } from '@/app/api/activities/_helpers';

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

  const actor = String(me.full_name ?? '').trim();
  if (!actor) return NextResponse.json({ message: 'allowed_users.full_name boş olamaz' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const activity_id = String(body.activity_id ?? '').trim();
  if (!activity_id) return NextResponse.json({ message: 'activity_id gerekli' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: found, error: foundErr } = await admin
    .from('pipeline_eventleri')
    .select('id,musteri_id,faz_no,owner,durum,created_by,aksiyon,partner_owner,notlar,hedef_tarihi')
    .eq('id', activity_id)
    .single();

  if (foundErr || !found) {
    return NextResponse.json({ message: foundErr?.message || 'Aktivite bulunamadı' }, { status: 404 });
  }

  if (!isAdminLike(me.role) && String((found as any).created_by ?? '').trim() !== actor) {
    return NextResponse.json({ message: 'Bu aktiviteyi güncelleme yetkin yok' }, { status: 403 });
  }

  const payload: Record<string, unknown> = {};

  if (typeof body.activity_label === 'string') {
    const label = body.activity_label.trim();
    payload.aksiyon = label ? `AKTIVITE:${label}` : (found as any).aksiyon ?? 'AKTIVITE:Diğer';
  }

  if (body.activity_status !== undefined) {
    const nextStatus = normalizeDurum(body.activity_status);
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

  payload.created_by = actor;

  const { error: updateErr } = await admin.from('pipeline_eventleri').update(payload).eq('id', activity_id);
  if (updateErr) return NextResponse.json({ message: updateErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
