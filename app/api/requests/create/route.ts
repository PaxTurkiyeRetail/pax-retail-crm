import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getAllowedUserNameForRequests } from '@/lib/request-users';
import { userHasPermission } from '@/lib/permissions';
import { z } from 'zod';
import { apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { tryRecordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createRequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(10_000).optional().default(''),
  category_id: z.string().uuid().nullish(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  assignee_id: z.string().uuid().nullish(),
  due_at: z.iso.datetime({ offset: true }).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
}).strict();

export async function POST(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb = createPgAdminClient();
    const body = await parseJsonBody(req, createRequestSchema);

    const { title, description, category_id, priority, assignee_id: rawAssigneeId, due_at, tags } = body;
    if (!title?.trim()) return NextResponse.json({ message: 'Başlık zorunlu' }, { status: 400 });

    const assignee_id = userHasPermission(user, 'request.manage') ? (rawAssigneeId || null) : null;

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

    await tryRecordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      action: 'request.created',
      resourceType: 'request',
      resourceId: String(request.id),
      after: request,
    });

    revalidatePath('/requests');
    return NextResponse.json(request, { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Talep oluşturulamadı.');
  }
}
