import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getAllowedUserNameForRequests } from '@/lib/request-users';
import { canManageRequests } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb = createPgAdminClient();
    const body = await req.json();
    const { id, action, ...payload } = body;

    if (!id) return NextResponse.json({ message: 'id zorunlu' }, { status: 400 });

    const { data: current, error: fetchError } = await sb.from('requests').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;
    if (!current) return NextResponse.json({ message: 'Talep bulunamadı' }, { status: 404 });

    let updateData: Record<string, unknown> = {};
    let eventType = '';
    let eventPayload: Record<string, unknown> = {};

    if (action === 'status') {
      const newStatus = payload.status;
      updateData = { status: newStatus };
      if (newStatus === 'resolved' || newStatus === 'closed') updateData.resolved_at = new Date().toISOString();
      if (newStatus === 'in_progress' && !current.first_response_at) updateData.first_response_at = new Date().toISOString();
      eventType = 'status_changed';
      eventPayload = { from: current.status, to: newStatus };
    } else if (action === 'assign') {
      if (!canManageRequests(user.role)) {
        return NextResponse.json({ message: 'Atama yetkin yok' }, { status: 403 });
      }
      const assigneeId = payload.assignee_id || null;
      const assigneeName = await getAllowedUserNameForRequests(assigneeId as string | null);
      updateData = {
        assignee_id: assigneeId,
        assignee_name: assigneeName,
        assignee_source: 'manual',
        status: assigneeId ? 'assigned' : 'open',
      };
      eventType = current.assignee_id ? 'reassigned' : 'assigned';
      eventPayload = { from: current.assignee_id, to: assigneeId, to_name: assigneeName };
    } else if (action === 'priority') {
      if (!canManageRequests(user.role)) {
        return NextResponse.json({ message: 'Öncelik değiştirme yetkin yok' }, { status: 403 });
      }
      updateData = { priority: payload.priority };
      eventType = 'priority_changed';
      eventPayload = { from: current.priority, to: payload.priority };
    } else if (action === 'comment') {
      if (!payload.comment?.trim()) return NextResponse.json({ message: 'Yorum boş olamaz' }, { status: 400 });
      await sb.from('request_events').insert({
        request_id: id,
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        event_type: 'comment',
        payload: { comment: payload.comment.trim() },
      });
      revalidatePath('/requests');
      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json({ message: 'Bilinmeyen action' }, { status: 400 });
    }

    const { error: updateError } = await sb.from('requests').update(updateData).eq('id', id);
    if (updateError) throw updateError;

    await sb.from('request_events').insert({
      request_id: id,
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      event_type: eventType,
      payload: eventPayload,
    });

    revalidatePath('/requests');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
