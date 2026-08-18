import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { assertOwnedResourceAccess, requireAnyPermissionOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { completeActivitiesForSamePhase } from '@/lib/activity-phase-completion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { activity_id?: string };

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireAnyPermissionOrThrow>>;
  try { me = await requireAnyPermissionOrThrow(['activity.update.own', 'activity.update.any']); } catch (e: any) { return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 }); }

  const actor = String(me.full_name ?? me.email ?? '').trim();
  if (!actor) return NextResponse.json({ message: 'Kullanıcı kimliği bulunamadı' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const activity_id = String(body.activity_id ?? '').trim();
  if (!activity_id) return NextResponse.json({ message: 'activity_id gerekli' }, { status: 400 });

  const admin = createPgAdminClient();
  const { data: found, error: foundErr } = await admin.from('pipeline_eventleri').select('id,musteri_id,faz_no,iteration_no,owner,durum,created_by,created_by_user_id,created_by_email,activity_scope,affects_phase').eq('id', activity_id).single();
  if (foundErr || !found) return NextResponse.json({ message: foundErr?.message || 'Aktivite bulunamadı' }, { status: 404 });
  assertOwnedResourceAccess({ user: me, resource: { owner_user_id: found.created_by_user_id, owner_email: found.created_by_email, owner_name: found.created_by }, ownPermission: 'activity.update.own', anyPermission: 'activity.update.any' });

  const { error: upErr } = await admin.from('pipeline_eventleri').update({ durum: 'Tamamlandı', updated_by_user_id: me.id, updated_by_email: me.email, updated_at: new Date().toISOString() }).eq('id', activity_id);
  if (upErr) return NextResponse.json({ message: upErr.message }, { status: 400 });

  if ((found as any).affects_phase !== false && (found as any).musteri_id && (found as any).faz_no != null) {
    try {
      await completeActivitiesForSamePhase({
        musteri_id: String((found as any).musteri_id ?? '').trim(),
        faz_no: Number((found as any).faz_no),
        actor,
        actor_user_id: me.id,
        actor_email: me.email,
        owner: (found as any).owner ?? null,
        exclude_id: activity_id,
      });
    } catch (e: any) {
      return NextResponse.json({ message: e?.message || 'Aynı faz aktiviteleri tamamlanamadı' }, { status: 400 });
    }
  }

  revalidatePath('/crm/activities');
  return NextResponse.json({ ok: true });
}
