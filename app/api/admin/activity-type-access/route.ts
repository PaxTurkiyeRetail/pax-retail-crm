import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermissionOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';

const schema = z.object({
  activity_type_key: z.literal('business_partner_activity'),
  role_key: z.enum(['account_manager', 'admin', 'itsm', 'user']),
  can_view: z.boolean(), can_create: z.boolean(), can_change_phase: z.boolean(),
}).refine(v => !v.can_create || v.can_view, 'Oluşturma izni için görüntüleme izni gerekir.')
  .refine(v => !v.can_change_phase || v.can_create, 'Faz değiştirme izni için oluşturma izni gerekir.');

export async function GET() {
  try {
    await requirePermissionOrThrow('admin.rbac.manage');
    const result = await db.query(`select p.activity_type_key,p.role_key,r.label,p.can_view,p.can_create,p.can_change_phase
      from public.activity_type_role_permissions p join public.rbac_roles r on r.role_key=p.role_key
      where p.activity_type_key='business_partner_activity' order by p.role_key`);
    return NextResponse.json({ rows: result.rows });
  } catch (error) { return apiErrorResponse(error, 'Aktivite rol kuralları yüklenemedi.'); }
}

export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const actor = await requirePermissionOrThrow('admin.rbac.manage');
    const input = await parseJsonBody(request, schema);
    await client.query('begin');
    const before = (await client.query('select * from public.activity_type_role_permissions where activity_type_key=$1 and role_key=$2 for update', [input.activity_type_key, input.role_key])).rows[0];
    if (!before) throw new ApiError('NOT_FOUND', 'Rol kuralı bulunamadı.', 404);
    const after = (await client.query(`update public.activity_type_role_permissions set can_view=$3,can_create=$4,can_change_phase=$5,updated_at=now()
      where activity_type_key=$1 and role_key=$2 returning *`, [input.activity_type_key, input.role_key, input.can_view, input.can_create, input.can_change_phase])).rows[0];
    await recordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'activity_type.role_access.updated', resourceType: 'activity_type_role_access', resourceId: `${input.activity_type_key}:${input.role_key}`, before, after }, client);
    await client.query('commit'); return NextResponse.json({ row: after });
  } catch (error) { await client.query('rollback').catch(() => undefined); return apiErrorResponse(error, 'Aktivite rol kuralı güncellenemedi.'); }
  finally { client.release(); }
}
