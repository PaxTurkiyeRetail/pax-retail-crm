import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type Body = { activity_id?: string };

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireAllowedUserOrThrow>>;
  try { me = await requireAllowedUserOrThrow(); } catch (e: any) { return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 }); }

  const actor = (me.full_name ?? '').trim();
  if (!actor) return NextResponse.json({ message: 'allowed_users.full_name boş olamaz' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const activity_id = String(body.activity_id ?? '').trim();
  if (!activity_id) return NextResponse.json({ message: 'activity_id gerekli' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: found, error: foundErr } = await admin.from('pipeline_eventleri').select('id,musteri_id,faz_no,iteration_no,owner,durum,created_by').eq('id', activity_id).single();
  if (foundErr || !found) return NextResponse.json({ message: foundErr?.message || 'Aktivite bulunamadı' }, { status: 404 });
  if (!isAdminLike(me.role) && String((found as any).created_by ?? '') !== actor) return NextResponse.json({ message: 'Bu aktivite sana ait değil' }, { status: 403 });

  const { error: upErr } = await admin.from('pipeline_eventleri').update({ durum: 'Tamamlandı', created_by: actor }).eq('id', activity_id);
  if (upErr) return NextResponse.json({ message: upErr.message }, { status: 400 });

  if ((found as any).musteri_id && (found as any).faz_no != null) {
    await admin.from('musteri_pipeline').upsert({
      musteri_id: (found as any).musteri_id,
      aktif_faz_no: (found as any).faz_no,
      durum: 'Tamamlandı',
      owner: (found as any).owner ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'musteri_id' });
  }

  return NextResponse.json({ ok: true });
}
