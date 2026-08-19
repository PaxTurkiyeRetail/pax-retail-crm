import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireIdentityAccessOrThrow } from '@/lib/authz';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { recordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROLE_VALUES = ['super_admin', 'admin', 'account_manager', 'itsm', 'user'] as const;

const createSchema = z.object({
  tenantId: z.string().trim().min(1).max(200),
  groupId: z.string().trim().min(1).max(200),
  role: z.enum(ROLE_VALUES),
}).strict();

const updateSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
}).strict();

const deleteSchema = z.object({
  id: z.string().uuid(),
}).strict();

// Son aktif super_admin grup eşlemesi kilitli: silinemez/deaktive edilemez,
// başka bir role indirilemez. Birden fazla aktif super_admin eşlemesi varsa
// (redundancy) fazlalıklar güvenle kaldırılabilir.
//
// Transaction-safety: bütün mutation yolları (POST/PATCH/DELETE) önce
// pg_advisory_xact_lock ile aynı global anahtarı kilitler. Bu olmadan iki paralel
// transaction ayrı satırları 'for update' ile kilitleyip her ikisi de aynı anda
// count=2 görebilir ve ikisi de invariant'ı geçip sıfır aktif super_admin mapping
// bırakabilirdi (TOCTOU). Advisory lock tüm mapping mutasyonlarını serialize eder.
const SUPER_ADMIN_MAPPING_LOCK_KEY = 'auth_group_role_mappings:super_admin_invariant';

async function lockSuperAdminInvariant(client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }) {
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [SUPER_ADMIN_MAPPING_LOCK_KEY]);
}

async function assertActiveSuperAdminCountAbove(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  minimum: number,
) {
  const count = await client.query(
    `select count(*)::int as c from public.auth_group_role_mappings where role = 'super_admin' and is_active = true`,
  );
  if ((count.rows[0]?.c ?? 0) <= minimum) {
    throw new ApiError(
      'LAST_SUPER_ADMIN_MAPPING',
      'Son aktif super_admin grup eşlemesi silinemez veya değiştirilemez. Önce başka bir aktif super_admin eşlemesi tanımlayın.',
      409,
    );
  }
}

async function assertNotLastActiveSuperAdmin(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  mappingId: string,
) {
  const current = await client.query(
    'select id, role, is_active from public.auth_group_role_mappings where id = $1 for update',
    [mappingId],
  );
  const row = current.rows[0];
  if (!row) throw new ApiError('MAPPING_NOT_FOUND', 'Grup eşlemesi bulunamadı.', 404);
  if (row.role === 'super_admin' && row.is_active) {
    await assertActiveSuperAdminCountAbove(client, 1);
  }
  return row;
}

export async function GET() {
  try {
    await requireIdentityAccessOrThrow();
    const result = await db.query(
      `select id, tenant_id, group_id, role, is_active, created_at, updated_at
       from public.auth_group_role_mappings
       order by is_active desc, role, tenant_id, group_id`,
    );
    return NextResponse.json({ mappings: result.rows });
  } catch (error) {
    return apiErrorResponse(error, 'Grup eşlemeleri yüklenemedi.');
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireIdentityAccessOrThrow();
    const input = await parseJsonBody(request, createSchema);
    const client = await db.connect();
    try {
      await client.query('begin');
      await lockSuperAdminInvariant(client);

      // Upsert mevcut bir aktif super_admin mapping'i sessizce başka role çeviremez:
      // PATCH ile aynı invariant burada da uygulanır (POST bypass'i kapatıldı).
      const existing = await client.query(
        `select id, role, is_active from public.auth_group_role_mappings
         where tenant_id = $1 and group_id = $2 for update`,
        [input.tenantId, input.groupId],
      );
      const before = existing.rows[0] ?? null;
      const willDowngradeFromSuperAdmin = before?.role === 'super_admin' && before?.is_active && input.role !== 'super_admin';
      if (willDowngradeFromSuperAdmin) {
        await assertActiveSuperAdminCountAbove(client, 1);
      }

      const result = await client.query(
        `insert into public.auth_group_role_mappings (tenant_id, group_id, role, is_active)
         values ($1, $2, $3, true)
         on conflict (tenant_id, group_id) do update set role = excluded.role, is_active = true, updated_at = now()
         returning id, tenant_id, group_id, role, is_active, created_at, updated_at`,
        [input.tenantId, input.groupId, input.role],
      );
      const row = result.rows[0];
      await recordAuditEvent({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'identity.group_mapping.upserted',
        resourceType: 'auth_group_role_mapping',
        resourceId: row.id,
        before,
        after: row,
      }, client);
      await client.query('commit');
      return NextResponse.json({ mapping: row });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiErrorResponse(error, 'Grup eşlemesi oluşturulamadı.');
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireIdentityAccessOrThrow();
    const input = await parseJsonBody(request, updateSchema);
    if (input.role === undefined && input.isActive === undefined) {
      throw new ApiError('VALIDATION_ERROR', 'Güncellenecek alan yok.', 400);
    }
    const client = await db.connect();
    try {
      await client.query('begin');
      await lockSuperAdminInvariant(client);
      const before = await assertNotLastActiveSuperAdmin(client, input.id);
      const willDeactivate = input.isActive === false;
      const willDowngrade = input.role !== undefined && input.role !== 'super_admin' && before.role === 'super_admin' && before.is_active;
      if ((willDeactivate || willDowngrade) && before.role === 'super_admin' && before.is_active) {
        await assertActiveSuperAdminCountAbove(client, 1);
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      if (input.role !== undefined) {
        values.push(input.role);
        fields.push(`role = $${values.length}`);
      }
      if (input.isActive !== undefined) {
        values.push(input.isActive);
        fields.push(`is_active = $${values.length}`);
      }
      fields.push('updated_at = now()');
      values.push(input.id);
      const result = await client.query(
        `update public.auth_group_role_mappings set ${fields.join(', ')} where id = $${values.length}
         returning id, tenant_id, group_id, role, is_active, created_at, updated_at`,
        values,
      );
      const after = result.rows[0];
      await recordAuditEvent({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'identity.group_mapping.updated',
        resourceType: 'auth_group_role_mapping',
        resourceId: input.id,
        before,
        after,
      }, client);
      await client.query('commit');
      return NextResponse.json({ mapping: after });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiErrorResponse(error, 'Grup eşlemesi güncellenemedi.');
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireIdentityAccessOrThrow();
    const body = await request.json().catch(() => ({}));
    const input = deleteSchema.parse(body);
    const client = await db.connect();
    try {
      await client.query('begin');
      await lockSuperAdminInvariant(client);
      const before = await assertNotLastActiveSuperAdmin(client, input.id);
      await client.query('delete from public.auth_group_role_mappings where id = $1', [input.id]);
      await recordAuditEvent({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'identity.group_mapping.deleted',
        resourceType: 'auth_group_role_mapping',
        resourceId: input.id,
        before,
      }, client);
      await client.query('commit');
      return NextResponse.json({ ok: true });
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiErrorResponse(error, 'Grup eşlemesi silinemedi.');
  }
}
