import 'server-only';
import { db } from '@/lib/db';
import { canEditDefinition, canViewDefinition, type ReportUser } from '@/lib/report-builder/access';
import { parseReportDefinition, type ReportDefinition } from '@/lib/report-builder/types';
import { z } from 'zod';

// Kalıcılık: public.report_definitions (+ sürüm geçmişi). Silme yok → arşivleme (is_archived).

export const saveDefinitionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().default(''),
  visibility: z.enum(['private', 'roles', 'everyone']).default('private'),
  sharedRoles: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(10).default([]),
  definition: z.unknown(),
});

export type SavedDefinition = {
  id: string;
  title: string;
  description: string;
  owner_user_id: string;
  owner_name: string | null;
  visibility: 'private' | 'roles' | 'everyone';
  shared_roles: string[];
  is_template: boolean;
  version: number;
  definition: ReportDefinition;
  updated_at: string;
  is_favorite?: boolean;
};

type User = ReportUser & { roles?: readonly string[] };

const COLS = `d.id::text, d.title, d.description, d.owner_user_id, d.owner_name, d.visibility, d.shared_roles,
  d.is_template, d.version, d.definition, d.updated_at::text`;

function mapRow(row: any): SavedDefinition {
  return {
    id: row.id, title: row.title, description: row.description ?? '', owner_user_id: row.owner_user_id,
    owner_name: row.owner_name ?? null, visibility: row.visibility, shared_roles: row.shared_roles ?? [],
    is_template: Boolean(row.is_template), version: Number(row.version), definition: row.definition,
    updated_at: row.updated_at, is_favorite: Boolean(row.is_favorite),
  };
}

export async function listDefinitions(user: User): Promise<SavedDefinition[]> {
  const { rows } = await db.query(
    `select ${COLS}, (f.definition_id is not null) as is_favorite
     from public.report_definitions d
     left join public.report_favorites f on f.definition_id = d.id and f.user_id = $1 and f.is_active = true
     where d.is_archived = false
       and (d.owner_user_id = $1 or d.visibility = 'everyone' or d.is_template = true
            or (d.visibility = 'roles' and d.shared_roles && $2::text[]) or $3::boolean)
     order by (f.definition_id is not null) desc, d.updated_at desc
     limit 500`,
    [user.id, [...(user.roles ?? [])], user.permissions.includes('admin.users.manage')],
  );
  return rows.map(mapRow);
}

export async function getDefinition(user: User, id: string): Promise<SavedDefinition | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await db.query(`select ${COLS} from public.report_definitions d where d.id = $1 and d.is_archived = false`, [id]);
  const row = rows[0];
  if (!row) return null;
  if (!row.is_template && !canViewDefinition(user, row)) return null;
  return mapRow(row);
}

export async function createDefinition(user: User, input: z.infer<typeof saveDefinitionSchema>) {
  const definition = parseReportDefinition(input.definition);
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into public.report_definitions (title, description, owner_user_id, owner_name, visibility, shared_roles, definition)
       values ($1, $2, $3, $4, $5, $6::text[], $7::jsonb) returning id::text`,
      [input.title, input.description, user.id, user.full_name ?? user.email, input.visibility, input.sharedRoles, JSON.stringify(definition)],
    );
    await client.query(
      `insert into public.report_definition_versions (definition_id, version, definition, created_by) values ($1, 1, $2::jsonb, $3)`,
      [rows[0].id, JSON.stringify(definition), user.id],
    );
    await client.query('commit');
    return rows[0].id as string;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateDefinition(user: User, id: string, input: z.infer<typeof saveDefinitionSchema>) {
  const existing = await getDefinition(user, id);
  if (!existing) throw Object.assign(new Error('Rapor bulunamadı'), { status: 404 });
  if (!canEditDefinition(user, existing)) throw Object.assign(new Error('Bu raporu düzenleme yetkiniz yok'), { status: 403 });
  const definition = parseReportDefinition(input.definition);
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `update public.report_definitions
       set title = $2, description = $3, visibility = $4, shared_roles = $5::text[], definition = $6::jsonb,
           version = version + 1, updated_at = now(), updated_by = $7
       where id = $1 returning version`,
      [id, input.title, input.description, input.visibility, input.sharedRoles, JSON.stringify(definition), user.id],
    );
    await client.query(
      `insert into public.report_definition_versions (definition_id, version, definition, created_by) values ($1, $2, $3::jsonb, $4)
       on conflict (definition_id, version) do nothing`,
      [id, rows[0].version, JSON.stringify(definition), user.id],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveDefinition(user: User, id: string) {
  const existing = await getDefinition(user, id);
  if (!existing) throw Object.assign(new Error('Rapor bulunamadı'), { status: 404 });
  if (!canEditDefinition(user, existing)) throw Object.assign(new Error('Bu raporu arşivleme yetkiniz yok'), { status: 403 });
  await db.query(`update public.report_definitions set is_archived = true, updated_at = now(), updated_by = $2 where id = $1`, [id, user.id]);
}

export async function setFavorite(user: User, id: string, favorite: boolean) {
  const existing = await getDefinition(user, id);
  if (!existing) throw Object.assign(new Error('Rapor bulunamadı'), { status: 404 });
  if (favorite) {
    await db.query(`insert into public.report_favorites (user_id, definition_id) values ($1, $2)
       on conflict (user_id, definition_id) do update set is_active = true, created_at = now()`, [user.id, id]);
  } else {
    // Favori kaldırma: kullanıcıya ait işaret satırı (iş verisi değil). Kayıt kalır, bayrak kapanır.
    await db.query(`update public.report_favorites set is_active = false where user_id = $1 and definition_id = $2`, [user.id, id]);
  }
}
