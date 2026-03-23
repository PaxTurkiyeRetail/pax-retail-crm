import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb = createSupabaseAdminClient();
    const body = await req.json();

    const { title, description, category_id, priority, assignee_id, due_at, tags } = body;
    if (!title?.trim()) return NextResponse.json({ message: 'Başlık zorunlu' }, { status: 400 });

    // Get SLA hours from category
    let sla_hours = 24;
    let assignee_name: string | null = null;
    if (category_id) {
      const { data: cat } = await sb.from('request_categories').select('sla_hours').eq('id', category_id).single();
      if (cat) sla_hours = cat.sla_hours;
    }
    if (assignee_id) {
      const { data: au } = await sb.from('allowed_users').select('full_name').eq('user_id', assignee_id).single();
      assignee_name = au?.full_name ?? null;
    }

    const { data: request, error } = await sb.from('requests').insert({
      title:          title.trim(),
      body:           (description || '').trim(),
      category_id:    category_id || null,
      priority:       priority || 'medium',
      assignee_id:    assignee_id || null,
      assignee_name,
      assignee_source: assignee_id ? 'manual' : null,
      due_at:         due_at || null,
      tags:           tags || [],
      sla_hours,
      status:         assignee_id ? 'assigned' : 'open',
      channel:        'manual',
      requester_id:   user.id,
      requester_name: user.full_name,
    }).select().single();

    if (error) throw error;

    // Log creation event
    await sb.from('request_events').insert({
      request_id: request.id,
      actor_id:   user.id,
      actor_name: user.full_name,
      event_type: 'created',
      payload:    { title: request.title, priority: request.priority },
    });

    // Log assignment event if assignee set
    if (assignee_id) {
      await sb.from('request_events').insert({
        request_id: request.id,
        actor_id:   user.id,
        actor_name: user.full_name,
        event_type: 'assigned',
        payload:    { to: assignee_id, to_name: assignee_name },
      });
    }

    revalidatePath('/requests');
    return NextResponse.json(request, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
