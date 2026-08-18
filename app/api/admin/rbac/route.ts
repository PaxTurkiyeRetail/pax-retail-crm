import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermissionOrThrow } from '@/lib/authz';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { recordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateSchema = z.object({
  roleKey: z.enum(['admin', 'account_manager', 'itsm', 'user']),
  permissionKey: z.string().trim().min(3).max(100),
  granted: z.boolean(),
}).strict();

export async function GET() {
  try {
    await requirePermissionOrThrow('admin.rbac.manage');
    const [roles, permissions, mappings] = await Promise.all([
      db.query('select role_key, label, description, is_active from public.rbac_roles order by role_key'),
      db.query('select permission_key, module_key, label, description from public.rbac_permissions order by module_key, permission_key'),
      db.query('select role_key, permission_key, granted from public.rbac_role_permissions order by role_key, permission_key'),
    ]);
    return NextResponse.json({ roles: roles.rows, permissions: permissions.rows, mappings: mappings.rows });
  } catch (error) {
    return apiErrorResponse(error, 'Rol ve yetkiler yüklenemedi.');
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermissionOrThrow('admin.rbac.manage');
    const input = await parseJsonBody(request, updateSchema);
    const client = await db.connect();
    try {
      await client.query('begin');
      const permission = await client.query(
        'select permission_key from public.rbac_permissions where permission_key = $1 limit 1',
        [input.permissionKey],
      );
      if (!permission.rowCount) throw new ApiError('PERMISSION_NOT_FOUND', 'Yetki tanımı bulunamadı.', 404);
      const before = await client.query(
        'select granted from public.rbac_role_permissions where role_key = $1 and permission_key = $2 for update',
        [input.roleKey, input.permissionKey],
      );
      await client.query(
        `insert into public.rbac_role_permissions(role_key, permission_key, granted, updated_at)
         values ($1,$2,$3,now())
         on conflict (role_key, permission_key)
         do update set granted = excluded.granted, updated_at = now()`,
        [input.roleKey, input.permissionKey, input.granted],
      );
      await recordAuditEvent({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'rbac.permission.changed',
        resourceType: 'role_permission',
        resourceId: `${input.roleKey}:${input.permissionKey}`,
        before: before.rows[0] ?? null,
        after: input,
      }, client);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Rol yetkisi güncellenemedi.');
  }
}
