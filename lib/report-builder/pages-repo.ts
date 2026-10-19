import 'server-only';
import { z } from 'zod';
import { tryRecordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { canDesignPages, canEditDefinition, canViewDefinition, type ReportUser } from '@/lib/report-builder/access';
import { letterheadSettingsSchema, parsePageDefinition, type LetterheadSettings, type PageDefinition } from '@/lib/report-builder/page-types';
import { getPageTemplate } from '@/lib/report-builder/templates';

// Kalıcılık: report_pages (+ report_page_versions) ve report_letterheads. Silme yok → arşiv / pasif.

type User = ReportUser & { roles?: readonly string[] };
const UUID = /^[0-9a-f-]{36}$/i;
const notFound = () => Object.assign(new Error('Sayfa bulunamadı'), { status: 404 });
const forbidden = (m = 'Bu işlem için yetkiniz yok') => Object.assign(new Error(m), { status: 403 });

export const savePageSchema = z.object({
  visibility: z.enum(['private', 'roles', 'everyone']).default('private'),
  sharedRoles: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(10).default([]),
  letterheadId: z.string().uuid().nullable().optional(),
  isTemplate: z.boolean().optional(),
  page: z.unknown(),
  /** İyimser kilit: istemcinin düzenlediği sürüm. Uyuşmazsa 409. */
  baseVersion: z.number().int().positive().optional(),
});
export type SavePageInput = z.infer<typeof savePageSchema>;

export type SavedPage = {
  id: string;
  title: string;
  owner_user_id: string;
  owner_name: string | null;
  visibility: 'private' | 'roles' | 'everyone';
  shared_roles: string[];
  is_template: boolean;
  template_key: string | null;
  version: number;
  letterhead_id: string | null;
  page: PageDefinition;
  updated_at: string;
  can_edit: boolean;
};

const COLS = `p.id::text, p.title, p.owner_user_id, p.owner_name, p.visibility, p.shared_roles, p.is_template, p.template_key,
  p.version, p.letterhead_id::text, p.page, p.updated_at::text`;

function mapRow(user: User, row: any): SavedPage {
  return {
    id: row.id, title: row.title, owner_user_id: row.owner_user_id, owner_name: row.owner_name ?? null,
    visibility: row.visibility, shared_roles: row.shared_roles ?? [], is_template: Boolean(row.is_template),
    template_key: row.template_key ?? null, version: Number(row.version), letterhead_id: row.letterhead_id ?? null,
    page: row.page, updated_at: row.updated_at, can_edit: canDesignPages(user) && canEditDefinition(user, row),
  };
}

export async function listPages(user: User): Promise<Omit<SavedPage, 'page'>[]> {
  const { rows } = await db.query(
    `select ${COLS.replace('p.page,', '')}
     from public.report_pages p
     where p.is_archived = false
       and (p.owner_user_id = $1 or p.visibility = 'everyone' or p.is_template = true
            or (p.visibility = 'roles' and p.shared_roles && $2::text[]) or $3::boolean)
     order by p.is_template, p.updated_at desc
     limit 300`,
    [user.id, [...(user.roles ?? [])], user.permissions.includes('admin.users.manage')],
  );
  return rows.map((r) => { const { page: _p, ...rest } = mapRow(user, { ...r, page: null }); return rest; });
}

export async function getPage(user: User, id: string): Promise<SavedPage | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await db.query(`select ${COLS} from public.report_pages p where p.id = $1 and p.is_archived = false`, [id]);
  const row = rows[0];
  if (!row) return null;
  if (!row.is_template && !canViewDefinition(user, row)) return null;
  return mapRow(user, row);
}

export async function createPage(user: User, input: SavePageInput, templateKey?: string) {
  if (!canDesignPages(user)) throw forbidden('Sayfa tasarlama yetkiniz yok (report.builder.design)');
  const page = templateKey ? getPageTemplate(templateKey) : parsePageDefinition(input.page);
  if (!page) throw Object.assign(new Error('Şablon bulunamadı'), { status: 404 });
  const isTemplate = Boolean(input.isTemplate) && user.permissions.includes('admin.users.manage');
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into public.report_pages (title, owner_user_id, owner_name, visibility, shared_roles, is_template, page, letterhead_id, updated_by)
       values ($1, $2, $3, $4, $5::text[], $6, $7::jsonb, $8::uuid, $2) returning id::text`,
      [page.title, user.id, user.full_name ?? user.email, input.visibility, input.sharedRoles, isTemplate, JSON.stringify(page), input.letterheadId ?? null],
    );
    await client.query(
      `insert into public.report_page_versions (page_id, version, page, title, created_by) values ($1, 1, $2::jsonb, $3, $4)`,
      [rows[0].id, JSON.stringify(page), page.title, user.id],
    );
    await client.query('commit');
    await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'report_page.create', resourceType: 'report_page', resourceId: rows[0].id, after: { title: page.title, templateKey } });
    return rows[0].id as string;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePage(user: User, id: string, input: SavePageInput) {
  const existing = await getPage(user, id);
  if (!existing) throw notFound();
  if (!existing.can_edit) throw forbidden();
  const page = parsePageDefinition(input.page);
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `update public.report_pages
       set title = $2, visibility = $3, shared_roles = $4::text[], page = $5::jsonb, letterhead_id = $6::uuid,
           version = version + 1, updated_at = now(), updated_by = $7
       where id = $1 and ($8::int is null or version = $8::int)
       returning version`,
      [id, page.title, input.visibility, input.sharedRoles, JSON.stringify(page), input.letterheadId ?? null, user.id, input.baseVersion ?? null],
    );
    if (!rows[0]) throw Object.assign(new Error('Sayfa başka biri tarafından güncellendi; yenileyip tekrar deneyin.'), { status: 409 });
    await client.query(
      `insert into public.report_page_versions (page_id, version, page, title, created_by) values ($1, $2, $3::jsonb, $4, $5)
       on conflict (page_id, version) do nothing`,
      [id, rows[0].version, JSON.stringify(page), page.title, user.id],
    );
    await client.query('commit');
    await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'report_page.update', resourceType: 'report_page', resourceId: id, before: { version: existing.version }, after: { version: rows[0].version } });
    return Number(rows[0].version);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listPageVersions(user: User, id: string) {
  const existing = await getPage(user, id);
  if (!existing) throw notFound();
  const { rows } = await db.query(
    `select version, title, created_at::text, created_by from public.report_page_versions where page_id = $1 order by version desc limit 100`, [id],
  );
  return rows;
}

/** Geri alma: eski sürümün içeriği yeni sürüm olarak yazılır (geçmiş korunur). */
export async function restorePageVersion(user: User, id: string, version: number) {
  const existing = await getPage(user, id);
  if (!existing) throw notFound();
  if (!existing.can_edit) throw forbidden();
  const { rows } = await db.query(`select page from public.report_page_versions where page_id = $1 and version = $2`, [id, version]);
  if (!rows[0]) throw Object.assign(new Error('Sürüm bulunamadı'), { status: 404 });
  return updatePage(user, id, { visibility: existing.visibility, sharedRoles: existing.shared_roles, letterheadId: existing.letterhead_id, page: rows[0].page });
}

export async function archivePage(user: User, id: string) {
  const existing = await getPage(user, id);
  if (!existing) throw notFound();
  if (!existing.can_edit) throw forbidden();
  await db.query(`update public.report_pages set is_archived = true, updated_at = now(), updated_by = $2 where id = $1`, [id, user.id]);
  await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'report_page.archive', resourceType: 'report_page', resourceId: id });
}

// ---------------------------------------------------------------------------
// Antetler
// ---------------------------------------------------------------------------
export type LetterheadRow = LetterheadSettings & { id: string; mimeType: string; byteSize: number; updatedAt: string };

function mapLetterhead(r: any): LetterheadRow {
  return {
    ...letterheadSettingsSchema.parse({
      name: r.name, orientation: r.orientation, margins: r.margins_mm, safeArea: r.safe_area_mm, showTitle: r.show_title,
      showDate: r.show_date, showPageNumbers: r.show_page_numbers, footerText: r.footer_text, isDefault: r.is_default,
    }),
    id: r.id, mimeType: r.mime_type, byteSize: Number(r.byte_size), updatedAt: r.updated_at,
  };
}

const LH_COLS = `id::text, name, mime_type, byte_size, orientation, margins_mm, safe_area_mm, show_title, show_date,
  show_page_numbers, footer_text, is_default, updated_at::text`;

export async function listLetterheads(): Promise<LetterheadRow[]> {
  const { rows } = await db.query(`select ${LH_COLS} from public.report_letterheads where is_active = true order by is_default desc, name`);
  return rows.map(mapLetterhead);
}

/** PDF için antet: id verilmezse varsayılan; bulunamazsa null (antetsiz PDF). */
export async function loadLetterheadAsset(id: string | null | undefined) {
  const { rows } = id && UUID.test(id)
    ? await db.query(`select ${LH_COLS}, image_data from public.report_letterheads where id = $1 and is_active = true`, [id])
    : await db.query(`select ${LH_COLS}, image_data from public.report_letterheads where is_default = true and is_active = true limit 1`);
  const r = rows[0];
  if (!r) return null;
  return { settings: mapLetterhead(r), bytes: new Uint8Array(r.image_data as Buffer), mimeType: r.mime_type as 'image/png' | 'image/jpeg' | 'application/pdf' };
}

export async function loadLetterheadImage(id: string) {
  if (!UUID.test(id)) return null;
  const { rows } = await db.query(`select mime_type, image_data from public.report_letterheads where id = $1 and is_active = true`, [id]);
  return rows[0] ? { mimeType: rows[0].mime_type as string, bytes: rows[0].image_data as Buffer } : null;
}

export async function createLetterhead(user: User, settings: LetterheadSettings, file: { bytes: Uint8Array; mimeType: string }) {
  const client = await db.connect();
  try {
    await client.query('begin');
    if (settings.isDefault) await client.query(`update public.report_letterheads set is_default = false, updated_at = now() where is_default = true`);
    const { rows } = await client.query(
      `insert into public.report_letterheads (name, mime_type, image_data, byte_size, orientation, margins_mm, safe_area_mm,
         show_title, show_date, show_page_numbers, footer_text, is_default, created_by)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13) returning id::text`,
      [settings.name, file.mimeType, Buffer.from(file.bytes), file.bytes.byteLength, settings.orientation, JSON.stringify(settings.margins),
        JSON.stringify(settings.safeArea), settings.showTitle, settings.showDate, settings.showPageNumbers, settings.footerText, settings.isDefault, user.id],
    );
    await client.query('commit');
    await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'report_letterhead.create', resourceType: 'report_letterhead', resourceId: rows[0].id, after: { name: settings.name, mime: file.mimeType, size: file.bytes.byteLength } });
    return rows[0].id as string;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateLetterhead(user: User, id: string, settings: LetterheadSettings) {
  if (!UUID.test(id)) throw notFound();
  const client = await db.connect();
  try {
    await client.query('begin');
    if (settings.isDefault) await client.query(`update public.report_letterheads set is_default = false, updated_at = now() where is_default = true and id <> $1`, [id]);
    const { rowCount } = await client.query(
      `update public.report_letterheads set name = $2, orientation = $3, margins_mm = $4::jsonb, safe_area_mm = $5::jsonb, show_title = $6,
         show_date = $7, show_page_numbers = $8, footer_text = $9, is_default = $10, updated_at = now()
       where id = $1 and is_active = true`,
      [id, settings.name, settings.orientation, JSON.stringify(settings.margins), JSON.stringify(settings.safeArea), settings.showTitle,
        settings.showDate, settings.showPageNumbers, settings.footerText, settings.isDefault],
    );
    if (!rowCount) throw notFound();
    await client.query('commit');
    await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'report_letterhead.update', resourceType: 'report_letterhead', resourceId: id, after: settings });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Silme yok: pasifleştirir (varsayılansa varsayılanlıktan da çıkar). */
export async function deactivateLetterhead(user: User, id: string) {
  if (!UUID.test(id)) throw notFound();
  await db.query(`update public.report_letterheads set is_active = false, is_default = false, updated_at = now() where id = $1`, [id]);
  await tryRecordAuditEvent({ actorId: user.id, actorEmail: user.email, action: 'report_letterhead.deactivate', resourceType: 'report_letterhead', resourceId: id });
}
