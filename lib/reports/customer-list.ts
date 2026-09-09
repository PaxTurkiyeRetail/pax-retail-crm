import 'server-only';
import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { ApiError } from '@/lib/http/api-error';
import {
  FIRM_NAME_MAX,
  cleanFirmName,
  countsByOwner,
  firmKey,
  normalizeName,
  orderOwners,
  siraBefore,
  type CustomerListCategory,
  type CustomerListCounts,
  type CustomerListItem,
  type CustomerListOwner,
} from './customer-list-shared';

// Müşteri Listesi (H/F/L/K) — veri erişimi + iş kuralları. Tablo: crm_musteri_listesi
// (migration 025). Kaldırma soft-delete (is_active=false); her yazma işlemi aynı
// transaction içinde crm_audit_events'e düşer (resource_type 'customer_list_item').
//
// Kişi anahtarı görünen ad (`satici`): Canlı Ekran da kişileri adla eşler
// (OWNER_ORDER). owner_user_id ada eşlik eder; kişi seçilince ikisi birlikte yazılır.

type Actor = { id: string; email: string };

type DbRow = {
  id: string;
  kategori: CustomerListCategory;
  satici: string;
  owner_user_id: string | null;
  firma: string;
  sira: number;
  note: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

const SELECT_ITEM = `
  select l.id::text as id, l.kategori, l.satici, l.owner_user_id::text as owner_user_id,
         l.firma, l.sira, l.note, l.updated_at::text as updated_at, l.updated_by
  from public.crm_musteri_listesi l
`;

const Q_ITEMS = `${SELECT_ITEM} where l.is_active order by lower(l.satici), l.kategori, l.sira, l.firma`;

// Kolon adayları: aktif account_manager'lar (Canlı Ekran Q_OWNERS ile aynı ölçüt).
const Q_OWNERS = `
  select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
  from public.allowed_users u
  where u.is_active = true
    and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
  order by 2
`;

function toItem(row: DbRow): CustomerListItem {
  return {
    id: row.id,
    category: row.kategori,
    owner: row.satici,
    ownerUserId: row.owner_user_id,
    firma: row.firma,
    sira: Number(row.sira ?? 0),
    note: row.note,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function isMissingTable(error: unknown) {
  return (error as { code?: string } | null)?.code === '42P01';
}

export async function loadCustomerList(): Promise<{ items: CustomerListItem[]; owners: CustomerListOwner[] }> {
  const [itemResult, ownerResult] = await Promise.all([db.query<DbRow>(Q_ITEMS), db.query<{ id: string; name: string }>(Q_OWNERS)]);
  const items = itemResult.rows.map(toItem);
  const owners = orderOwners(ownerResult.rows.map((row) => ({ id: row.id, name: row.name })), items);
  return { items, owners };
}

/**
 * Canlı Ekran için: kişi adı anahtarı (normalizeName) → H/F/L/K sayıları.
 * Tablo henüz yoksa (migration uygulanmadan build alındıysa) boş harita döner —
 * pano çökmez, donut "liste yok" der.
 */
export async function loadCustomerListCounts(): Promise<Map<string, CustomerListCounts>> {
  try {
    const { rows } = await db.query<DbRow>(Q_ITEMS);
    return countsByOwner(rows.map(toItem));
  } catch (error) {
    if (isMissingTable(error)) return new Map();
    throw error;
  }
}

/* ------------------------------------------------------------------------ */
/* Yazma işlemleri                                                           */
/* ------------------------------------------------------------------------ */

async function resolveOwner(client: PoolClient, input: { ownerUserId?: string | null; owner?: string | null }): Promise<{ satici: string; ownerUserId: string | null }> {
  if (input.ownerUserId) {
    const { rows } = await client.query<{ id: string; name: string }>(
      `select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
       from public.allowed_users u where u.id = $1 and u.is_active = true limit 1`,
      [input.ownerUserId],
    );
    if (!rows[0]) throw new ApiError('OWNER_NOT_FOUND', 'Seçilen kişi bulunamadı ya da pasif.', 404);
    return { satici: rows[0].name, ownerUserId: rows[0].id };
  }
  const name = cleanFirmName(String(input.owner ?? ''));
  if (!name) throw new ApiError('OWNER_REQUIRED', 'Kişi seçilmeli.', 400);
  // Adı bilinen bir kullanıcıysa id'yi de bağla.
  const { rows } = await client.query<{ id: string; name: string }>(
    `select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
     from public.allowed_users u where u.is_active = true`,
  );
  const hit = rows.find((row) => normalizeName(row.name) === normalizeName(name));
  return { satici: hit?.name ?? name, ownerUserId: hit?.id ?? null };
}

function validateFirm(value: string) {
  const firma = cleanFirmName(value);
  if (!firma) throw new ApiError('FIRM_REQUIRED', 'Firma adı boş olamaz.', 400);
  if (firma.length > FIRM_NAME_MAX) throw new ApiError('FIRM_TOO_LONG', `Firma adı en fazla ${FIRM_NAME_MAX} karakter olabilir.`, 400);
  return firma;
}

async function assertNoDuplicate(client: PoolClient, args: { category: CustomerListCategory; satici: string; firma: string; excludeId?: string | null }) {
  const { rows } = await client.query<{ id: string; firma: string }>(
    `select id::text as id, firma from public.crm_musteri_listesi
     where is_active and kategori = $1 and lower(satici) = lower($2) and lower(trim(firma)) = lower(trim($3))
       and ($4::uuid is null or id <> $4::uuid) limit 1`,
    [args.category, args.satici, args.firma, args.excludeId ?? null],
  );
  if (rows[0]) {
    throw new ApiError('DUPLICATE_FIRM', `"${rows[0].firma}" bu kişinin ${args.category} listesinde zaten var.`, 409, { id: rows[0].id });
  }
}

async function cellOf(client: PoolClient, satici: string, category: CustomerListCategory): Promise<CustomerListItem[]> {
  const { rows } = await client.query<DbRow>(
    `${SELECT_ITEM} where l.is_active and l.kategori = $1 and lower(l.satici) = lower($2) order by l.sira, l.firma`,
    [category, satici],
  );
  return rows.map(toItem);
}

/** Hücreyi 10'ar adımla yeniden numaralar (sıra çakışmasında). */
async function renumberCell(client: PoolClient, satici: string, category: CustomerListCategory, orderedIds: string[]) {
  for (let index = 0; index < orderedIds.length; index += 1) {
    await client.query(`update public.crm_musteri_listesi set sira = $2 where id = $1`, [orderedIds[index], (index + 1) * 10]);
  }
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function getForUpdate(client: PoolClient, id: string): Promise<DbRow> {
  const { rows } = await client.query<DbRow>(`${SELECT_ITEM} where l.id = $1 and l.is_active for update`, [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND', 'Kayıt bulunamadı (kaldırılmış olabilir).', 404);
  return rows[0];
}

export type CreateItemInput = {
  category: CustomerListCategory;
  ownerUserId?: string | null;
  owner?: string | null;
  firma: string;
  note?: string | null;
};

export async function createItem(actor: Actor, input: CreateItemInput): Promise<CustomerListItem> {
  return withTransaction(async (client) => {
    const firma = validateFirm(input.firma);
    const owner = await resolveOwner(client, input);
    await assertNoDuplicate(client, { category: input.category, satici: owner.satici, firma });
    const cell = await cellOf(client, owner.satici, input.category);
    const sira = cell.length ? Math.max(...cell.map((item) => item.sira)) + 10 : 10;
    const { rows } = await client.query<DbRow>(
      `insert into public.crm_musteri_listesi (kategori, satici, owner_user_id, firma, sira, note, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $7)
       returning id::text as id, kategori, satici, owner_user_id::text as owner_user_id, firma, sira, note, updated_at::text as updated_at, updated_by`,
      [input.category, owner.satici, owner.ownerUserId, firma, sira, input.note?.trim() || null, actor.email],
    );
    const after = toItem(rows[0]);
    await recordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'customer_list.item.created', resourceType: 'customer_list_item', resourceId: after.id, after }, client);
    return after;
  });
}

export type UpdateItemInput = {
  firma?: string;
  note?: string | null;
  /** Taşıma: yeni kategori ve/veya kişi. */
  category?: CustomerListCategory;
  ownerUserId?: string | null;
  owner?: string | null;
  /** Hedef hücrede bu kaydın ÖNÜNE yerleştir (sürükle-bırak); null/undefined → sona. */
  beforeId?: string | null;
};

export async function updateItem(actor: Actor, id: string, input: UpdateItemInput): Promise<CustomerListItem> {
  return withTransaction(async (client) => {
    const beforeRow = await getForUpdate(client, id);
    const before = toItem(beforeRow);

    const firma = input.firma != null ? validateFirm(input.firma) : before.firma;
    const category = input.category ?? before.category;
    const owner = input.ownerUserId || input.owner
      ? await resolveOwner(client, input)
      : { satici: before.owner, ownerUserId: before.ownerUserId };
    const note = input.note === undefined ? before.note : (input.note?.trim() || null);

    const movingCell = category !== before.category || normalizeName(owner.satici) !== normalizeName(before.owner);
    if (firmKey(firma) !== firmKey(before.firma) || movingCell) {
      await assertNoDuplicate(client, { category, satici: owner.satici, firma, excludeId: id });
    }

    // Sıra: hücre değişiyorsa ya da beforeId verildiyse hedef hücrede yeniden konumlandır.
    let sira = before.sira;
    const targetCell = (await cellOf(client, owner.satici, category)).filter((item) => item.id !== id);
    if (movingCell || input.beforeId !== undefined) {
      const placed = siraBefore(targetCell, input.beforeId ?? null);
      sira = placed.sira;
      if (placed.renumber) {
        const index = input.beforeId ? targetCell.findIndex((item) => item.id === input.beforeId) : -1;
        const ordered = targetCell.map((item) => item.id);
        if (index === -1) ordered.push(id);
        else ordered.splice(index, 0, id);
        await renumberCell(client, owner.satici, category, ordered);
        sira = (ordered.indexOf(id) + 1) * 10;
      }
    }

    const { rows } = await client.query<DbRow>(
      `update public.crm_musteri_listesi
         set kategori = $2, satici = $3, owner_user_id = $4, firma = $5, sira = $6, note = $7, updated_at = now(), updated_by = $8
       where id = $1
       returning id::text as id, kategori, satici, owner_user_id::text as owner_user_id, firma, sira, note, updated_at::text as updated_at, updated_by`,
      [id, category, owner.satici, owner.ownerUserId, firma, sira, note, actor.email],
    );
    const after = toItem(rows[0]);
    await recordAuditEvent({
      actorId: actor.id, actorEmail: actor.email,
      action: movingCell ? 'customer_list.item.moved' : 'customer_list.item.updated',
      resourceType: 'customer_list_item', resourceId: id, before, after,
    }, client);
    return after;
  });
}

export async function deactivateItem(actor: Actor, id: string): Promise<CustomerListItem> {
  return withTransaction(async (client) => {
    const beforeRow = await getForUpdate(client, id);
    const before = toItem(beforeRow);
    await client.query(
      `update public.crm_musteri_listesi set is_active = false, updated_at = now(), updated_by = $2 where id = $1`,
      [id, actor.email],
    );
    await recordAuditEvent({ actorId: actor.id, actorEmail: actor.email, action: 'customer_list.item.removed', resourceType: 'customer_list_item', resourceId: id, before }, client);
    return before;
  });
}

