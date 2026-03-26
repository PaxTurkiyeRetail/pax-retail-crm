import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAllowedUserNameForRequests } from '@/lib/request-users';
import { canManageRequests } from '@/lib/roles';

export async function POST(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb = createSupabaseAdminClient();
    const body = await req.json();

    const { title, description, category_id, priority, assignee_id: rawAssigneeId, due_at, tags } = body;
    if (!title?.trim()) return NextResponse.json({ message: 'Başlık zorunlu' }, { status: 400 });

    const assignee_id = canManageRequests(user.role) ? (rawAssigneeId || null) : null;

    let sla_hours = 24;
    if (category_id) {
      const { data: cat } = await sb.from('request_categories').select('sla_hours').eq('id', category_id).single();
      if (cat?.sla_hours) sla_hours = cat.sla_hours;
    }

    const assignee_name = await getAllowedUserNameForRequests(assignee_id);

    const insertPayload = {
      title: title.trim(),
      body: (description || '').trim(),
      category_id: category_id || null,
      priority: priority || 'medium',
      assignee_id,
      assignee_name,
      assignee_source: 'manual',
      due_at: due_at || null,
      tags: Array.isArray(tags) ? tags : [],
      sla_hours,
      status: assignee_id ? 'assigned' : 'open',
      channel: 'manual',
      requester_id: user.id,
      requester_name: user.full_name || user.email,
    };

    const { data: request, error } = await sb.from('requests').insert(insertPayload).select().single();
    if (error) throw error;

    await sb.from('request_events').insert({
      request_id: request.id,
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      event_type: 'created',
      payload: { title: request.title, priority: request.priority },
    });

    if (assignee_id) {
      await sb.from('request_events').insert({
        request_id: request.id,
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        event_type: 'assigned',
        payload: { to: assignee_id, to_name: assignee_name },
      });
    }

    revalidatePath('/requests');
    return NextResponse.json(request, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
