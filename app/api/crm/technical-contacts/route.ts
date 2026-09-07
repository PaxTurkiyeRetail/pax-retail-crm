import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { requireAllowedUserOrThrow, type AllowedUser } from '@/lib/authz';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { ApiError, apiErrorResponse, parseJsonBody } from '@/lib/http/api-error';
import { canManageTechnicalContacts, canReadTechnicalContacts, createTechnicalContactSchema, updateTechnicalContactSchema } from '@/lib/technical-contacts';

export const dynamic = 'force-dynamic';
const columns = 'id,customer_id,full_name,phone,email,title,is_active,version';

async function customerAccess(client: Pick<PoolClient, 'query'>, user: AllowedUser, id: string, write = false) {
  const customer = (await client.query(`select id,owner_user_id,sorumlu from public.musteriler where id=$1${write ? ' for share' : ''}`, [id])).rows[0];
  if (!customer) throw new ApiError('NOT_FOUND', 'Firma bulunamadı.', 404);
  if (!(write ? canManageTechnicalContacts(user, customer) : canReadTechnicalContacts(user, customer))) {
    throw new ApiError('FORBIDDEN', 'Bu firmanın teknik yetkililerine erişim izniniz yok.', 403);
  }
  return customer;
}

function errorResponse(error: unknown) {
  if ((error as { code?: string })?.code === '42P01') {
    return apiErrorResponse(new ApiError('CONTACTS_NOT_READY', 'Teknik yetkililer bölümü henüz kullanıma açılmadı.', 503));
  }
  return apiErrorResponse(error, 'Teknik yetkili işlemi tamamlanamadı.');
}

export async function GET(request: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const customerId = z.uuid().parse(new URL(request.url).searchParams.get('customer_id'));
    const customer = await customerAccess(db, user, customerId);
    // Inactive contacts remain available to display historical activity links.
    const result = await db.query(`select ${columns} from public.customer_technical_contacts where customer_id=$1 order by is_active desc,full_name,id`, [customerId]);
    return NextResponse.json({ rows: result.rows, can_edit: canManageTechnicalContacts(user, customer) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  let client: PoolClient | undefined;
  try {
    const user = await requireAllowedUserOrThrow();
    const input = await parseJsonBody(request, createTechnicalContactSchema);
    client = await db.connect();
    await client.query('begin');
    await customerAccess(client, user, input.customer_id, true);
    const { rows: [row] } = await client.query(
      `insert into public.customer_technical_contacts(customer_id,full_name,phone,email,title,created_by_user_id,updated_by_user_id)
       values($1,$2,$3,$4,$5,$6,$6) returning ${columns}`,
      [input.customer_id, input.full_name, input.phone, input.email, input.title, user.id],
    );
    await recordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'technical_contact.created', resourceType: 'technical_contact', resourceId: row.id, after: row }, client);
    await client.query('commit');
    return NextResponse.json({ row }, { status: 201 });
  } catch (error) { await client?.query('rollback').catch(() => undefined); return errorResponse(error); }
  finally { client?.release(); }
}

export async function PATCH(request: Request) {
  let client: PoolClient | undefined;
  try {
    const user = await requireAllowedUserOrThrow();
    const input = await parseJsonBody(request, updateTechnicalContactSchema);
    client = await db.connect();
    await client.query('begin');
    await customerAccess(client, user, input.customer_id, true);
    const before = (await client.query(`select ${columns} from public.customer_technical_contacts where id=$1 and customer_id=$2 for update`, [input.id, input.customer_id])).rows[0];
    if (!before) throw new ApiError('NOT_FOUND', 'Teknik yetkili bulunamadı.', 404);
    if (before.version !== input.expected_version) throw new ApiError('VERSION_CONFLICT', 'Bu kişi başka bir kullanıcı tarafından güncellendi. Listeyi yenileyip tekrar deneyin.', 409);
    const next = { ...before, ...input };
    const { rows: [row] } = await client.query(
      `update public.customer_technical_contacts set full_name=$3,phone=$4,email=$5,title=$6,is_active=$7,
       version=version+1,updated_by_user_id=$8,updated_at=now() where id=$1 and customer_id=$2 returning ${columns}`,
      [input.id, input.customer_id, next.full_name, next.phone, next.email, next.title, next.is_active, user.id],
    );
    await recordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'technical_contact.updated', resourceType: 'technical_contact', resourceId: row.id, before, after: row }, client);
    await client.query('commit');
    return NextResponse.json({ row });
  } catch (error) { await client?.query('rollback').catch(() => undefined); return errorResponse(error); }
  finally { client?.release(); }
}
