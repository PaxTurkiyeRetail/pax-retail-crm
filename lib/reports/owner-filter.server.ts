// Satıcı filtresi — sunucu tarafı: aktif kullanıcılar (allowed_users) departman kapsamıyla.
import { db } from '@/lib/db';
import type { Department } from '@/lib/departments';
import type { FilterOption } from '@/lib/filters/schema';
import { buildOwnerOptions, type OwnerUser } from '@/lib/reports/owner-filter';

/**
 * Aktif kullanıcılar. departments verilirse departmanı kesişen ya da departmanı atanmamış
 * (tümü) kullanıcılar döner. departments kolonu yoksa (eski şema) departman süzgeci atlanır.
 */
export async function loadActiveOwnerUsers(departments?: Department[] | null): Promise<OwnerUser[]> {
  const base = `select id::text as id, coalesce(nullif(trim(full_name), ''), email) as name from public.allowed_users where is_active = true`;
  try {
    const { rows } = departments?.length
      ? await db.query(`${base} and (coalesce(cardinality(departments), 0) = 0 or departments && $1::text[]) order by 2`, [departments])
      : await db.query(`${base} order by 2`);
    return rows.map((r: any) => ({ id: String(r.id), name: String(r.name ?? '').trim() })).filter((r) => r.id && r.name);
  } catch (error) {
    if ((error as { code?: string })?.code !== '42703') throw error;
    const { rows } = await db.query(`${base} order by 2`);
    return rows.map((r: any) => ({ id: String(r.id), name: String(r.name ?? '').trim() })).filter((r) => r.id && r.name);
  }
}

export async function loadOwnerOptions(opts: { departments?: Department[] | null; includePseudo?: boolean; extraNames?: readonly string[] } = {}): Promise<FilterOption[]> {
  return buildOwnerOptions(await loadActiveOwnerUsers(opts.departments), opts);
}
