import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { assertOwnedResourceAccess, isResourceOwner, requireCrmAccessOrThrow, userHasPermission } from '@/lib/authz';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';

const updateSchema = z.object({
  customer_id: z.uuid(),
  customer: z.boolean(),
  business_partner: z.boolean(),
  partner_subtype: z.string().trim().max(120).nullable().optional(),
  integration_enabled: z.boolean().optional(),
}).refine(value => value.customer || value.business_partner, 'Firma en az bir ilişkiye sahip olmalıdır.');

async function customerForAccess(client: Pick<PoolClient, 'query'>, customerId: string) {
  const row = (await client.query('select id,owner_user_id,sorumlu,customer_type,is_ortagi_tipi,integration_enabled from public.musteriler where id=$1', [customerId])).rows[0];
  if (!row) throw new ApiError('NOT_FOUND', 'Firma bulunamadı.', 404);
  return row;
}

export async function GET(request: Request) {
  try {
    const user = await requireCrmAccessOrThrow();
    const customerId = z.uuid().parse(new URL(request.url).searchParams.get('customer_id'));
    const customer = await customerForAccess(db, customerId);
    assertOwnedResourceAccess({ user, resource: customer, ownPermission: 'customer.read', anyPermission: 'customer.read.any' });
    const rows = await db.query('select role_key,subtype,is_active,version from public.organization_roles where customer_id=$1 order by role_key', [customerId]);
    const canEdit = userHasPermission(user, 'customer.classification.manage') &&
      (userHasPermission(user, 'customer.update.any') || (userHasPermission(user, 'customer.update.own') && isResourceOwner(user, customer)));
    return NextResponse.json({ rows: rows.rows, integration_enabled: Boolean(customer.integration_enabled), can_edit: canEdit });
  } catch (error) { return apiErrorResponse(error, 'Firma ilişkileri yüklenemedi.'); }
}

export async function PATCH(request: Request) {
  let client: PoolClient | undefined;
  try {
    const user = await requireCrmAccessOrThrow();
    if (!userHasPermission(user, 'customer.classification.manage')) throw new ApiError('FORBIDDEN', 'Firma ilişkilerini değiştirme yetkiniz yok.', 403);
    const input = await parseJsonBody(request, updateSchema);
    client = await db.connect(); await client.query('begin');
    const customer = await customerForAccess(client, input.customer_id);
    assertOwnedResourceAccess({ user, resource: customer, ownPermission: 'customer.update.own', anyPermission: 'customer.update.any' });
    const beforeRoles = (await client.query('select role_key,subtype,is_active,version from public.organization_roles where customer_id=$1 order by role_key for update', [input.customer_id])).rows;
    const integrationEnabled = Boolean(
      (input.integration_enabled ?? customer.integration_enabled) ||
      (input.business_partner && input.partner_subtype === 'Entegrasyon Firması'),
    );
    for (const [roleKey, active] of [['customer', input.customer], ['business_partner', input.business_partner]] as const) {
      await client.query(`insert into public.organization_roles(customer_id,role_key,subtype,is_active,created_by_user_id,updated_by_user_id)
        values($1,$2,$3,$4,$5,$5) on conflict(customer_id,role_key) do update set subtype=excluded.subtype,is_active=excluded.is_active,
        version=organization_roles.version+1,updated_by_user_id=excluded.updated_by_user_id,updated_at=now()`,
      [input.customer_id, roleKey, roleKey === 'business_partner' ? (input.partner_subtype || null) : null, active, user.id]);
    }
    // Compatibility projection for unchanged reports/forms. Dual-role firms stay standard and are added to partner views through organization_roles.
    const legacyType = input.business_partner && !input.customer ? 'business_partner' : 'standard';
    await client.query('update public.musteriler set customer_type=$2,is_ortagi_tipi=$3,integration_enabled=$4,updated_at=now() where id=$1',
      [input.customer_id, legacyType, input.business_partner ? (input.partner_subtype || null) : null, integrationEnabled]);
    await client.query('select public.rebuild_musteri_pipeline($1)', [input.customer_id]);
    const after = (await client.query('select role_key,subtype,is_active,version from public.organization_roles where customer_id=$1 order by role_key', [input.customer_id])).rows;
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      action: 'customer.relationships.updated',
      resourceType: 'customer',
      resourceId: input.customer_id,
      before: { roles: beforeRoles, integration_enabled: Boolean(customer.integration_enabled) },
      after: { roles: after, integration_enabled: integrationEnabled },
    }, client);
    await client.query('commit');
    return NextResponse.json({ rows: after, integration_enabled: integrationEnabled });
  } catch (error) { await client?.query('rollback').catch(() => undefined); return apiErrorResponse(error, 'Firma ilişkileri güncellenemedi.'); }
  finally { client?.release(); }
}
