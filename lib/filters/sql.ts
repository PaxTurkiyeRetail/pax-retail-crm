// Parametreli SQL parça yardımcıları. Her biri değeri values dizisine ekler, $n placeholder'lı parça döner.
import { resolveDepartmentFilter, type Department } from '@/lib/departments';

export type SqlValues = unknown[];

export const ACTIVITY_DATE_COL = `coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)`;

const push = (values: SqlValues, v: unknown) => { values.push(v); return `$${values.length}`; };

/** col >= from and col < to + 1 gün (to inclusive). Boş sınır atlanır; ikisi de boşsa 'true'. */
export function activityDateRange(values: SqlValues, from?: string | null, to?: string | null, col: string = ACTIVITY_DATE_COL): string {
  const parts: string[] = [];
  if (from) parts.push(`${col} >= ${push(values, from)}::date`);
  if (to) parts.push(`${col} < (${push(values, to)}::date + 1)`);
  return parts.length ? parts.join(' and ') : 'true';
}

/** Departman süzgeci (kullanıcı izniyle uzlaştırılır). Filtre yoksa 'true'. */
export function departmentClause(values: SqlValues, requested: unknown, allowed: Department[] | null, col = 'm.is_kolu'): string {
  const list = resolveDepartmentFilter(requested, allowed);
  if (!list) return 'true';
  return `${col} = any(${push(values, list)}::text[])`;
}

/** Sahip/satıcı süzgeci — kullanıcı id ile (isimle değil). */
export function ownerIdClause(values: SqlValues, ownerId: string | number | null | undefined, col = 'pe.user_id'): string {
  if (ownerId === null || ownerId === undefined || ownerId === '') return 'true';
  return `${col} = ${push(values, ownerId)}`;
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const TR_FROM = 'İIıŞşĞğÜüÖöÇç';
const TR_TO = 'iiissgguuoocc';

/** JS tarafında aynı normalizasyon (test/istemci). */
export function trFold(s: string): string {
  let out = '';
  for (const ch of s) {
    const i = TR_FROM.indexOf(ch);
    out += i >= 0 ? TR_TO[i] : ch;
  }
  return out.toLowerCase();
}

export function trFoldSql(expr: string): string {
  return `lower(translate(${expr}, '${TR_FROM}', '${TR_TO}'))`;
}

/** Türkçe duyarsız içerir araması; birden fazla kolonda OR. Boş q → 'true'. */
export function searchClause(values: SqlValues, q: string | null | undefined, cols: string[]): string {
  const term = (q ?? '').trim();
  if (!term || !cols.length) return 'true';
  const p = push(values, `%${escapeLike(trFold(term))}%`);
  return `(${cols.map((c) => `${trFoldSql(`coalesce(${c}, '')`)} like ${p} escape '\\'`).join(' or ')})`;
}

export type PhaseRange = { min: number; max: number };

/** '1-4' → {1,4}; '5' → {5,5}; geçersiz → null. */
export function parsePhaseRange(raw: unknown, bounds: PhaseRange = { min: 0, max: 99 }): PhaseRange | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] !== undefined ? Number(m[2]) : a;
  if (a > b || a < bounds.min || b > bounds.max) return null;
  return { min: a, max: b };
}

export function phaseClause(values: SqlValues, raw: unknown, col = 'm.faz'): string {
  const r = parsePhaseRange(raw);
  if (!r) return 'true';
  if (r.min === r.max) return `${col} = ${push(values, r.min)}`;
  return `${col} between ${push(values, r.min)} and ${push(values, r.max)}`;
}
