import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length ? text : null;
}

export async function POST(req: Request) {
  try {
    const me = await requireAllowedUserOrThrow();
    const body = await req.json().catch(() => ({}));
    const activityId = String(body?.activity_id ?? '').trim();
    const blocked = Boolean(body?.blocked);
    const note = normalizeText(body?.note);

    if (!activityId) {
      return NextResponse.json({ message: 'activity_id gerekli' }, { status: 400 });
    }

    const admin = createPgAdminClient();
    const payload = blocked
      ? {
          is_blocked: true,
          blocked_note: note,
          blocked_at: new Date().toISOString(),
          blocked_by: normalizeText(me.full_name) ?? normalizeText(me.email),
          updated_by_user_id: me.id,
          updated_by_email: me.email,
          updated_at: new Date().toISOString(),
        }
      : {
          is_blocked: false,
          blocked_note: null,
          blocked_at: null,
          blocked_by: null,
          updated_by_user_id: me.id,
          updated_by_email: me.email,
          updated_at: new Date().toISOString(),
        };

    const { data, error } = await admin
      .from('pipeline_eventleri')
      .update(payload)
      .eq('id', activityId)
      .select('id,is_blocked,blocked_note,blocked_at,blocked_by')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ row: data });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
