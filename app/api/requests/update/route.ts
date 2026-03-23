import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb = createSupabaseAdminClient();
    const body = await req.json();
    const { id, action, ...payload } = body;

    if (!id) return NextResponse.json({ message: 'id zorunlu' }, { status: 400 });

    const { data: current, error: fetchError } = await sb
      .from('requests').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

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
    }

    else if (action === 'assign') {
      let assignee_name = null;
      if (payload.assignee_id) {
        const { data: au } = await sb.from('allowed_users').select('full_name').eq('user_id', payload.assignee_id).single();
        assignee_name = au?.full_name ?? null;
      }
      updateData = {
        assignee_id: payload.assignee_id || null,
        assignee_name,
        assignee_source: 'manual',
        status: payload.assignee_id ? 'assigned' : 'open',
      };
      eventType = current.assignee_id ? 'reassigned' : 'assigned';
      eventPayload = { from: current.assignee_id, to: payload.assignee_id, to_name: assignee_name };
    }

    else if (action === 'priority') {
      updateData = { priority: payload.priority };
      eventType = 'priority_changed';
      eventPayload = { from: current.priority, to: payload.priority };
    }

    else if (action === 'comment') {
      if (!payload.comment?.trim()) return NextResponse.json({ message: 'Yorum boş olamaz' }, { status: 400 });
      // Comments only go to events table, no request update needed
      await sb.from('request_events').insert({
        request_id: id, actor_id: user.id, actor_name: user.full_name,
        event_type: 'comment', payload: { comment: payload.comment.trim() },
      });
      revalidatePath('/requests');
      return NextResponse.json({ ok: true });
    }

    else {
      return NextResponse.json({ message: 'Bilinmeyen action' }, { status: 400 });
    }

    const { error: updateError } = await sb.from('requests').update(updateData).eq('id', id);
    if (updateError) throw updateError;

    await sb.from('request_events').insert({
      request_id: id, actor_id: user.id, actor_name: user.full_name,
      event_type: eventType, payload: eventPayload,
    });

    revalidatePath('/requests');
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
