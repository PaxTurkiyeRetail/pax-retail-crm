// Sayfa filtre konfigürasyonu + URL parametrelerinin güvenli ayrıştırılması (zod v4).
import { z } from 'zod';
import { DEPARTMENTS, resolveDepartmentFilter, type Department } from '@/lib/departments';
import { PERIOD_PRESETS, type PeriodPreset } from '@/lib/filters/period';
import { parsePhaseRange } from '@/lib/filters/sql';

export const FILTER_KEYS = ['period', 'from', 'to', 'department', 'owner', 'customer', 'phase', 'role', 'status', 'q'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export type FilterValues = {
  period?: PeriodPreset;
  from?: string;
  to?: string;
  department?: Department;
  owner?: string;
  customer?: string;
  phase?: string;
  role?: string;
  status?: string;
  q?: string;
};

/** group verilen seçenekler ayrı optgroup'ta, gruplu olmayanlardan sonra listelenir (ör. 'Havuz / Gruplar'). */
export type FilterOption = { value: string; label: string; group?: string };

export type PageFilterConfig = {
  keys: FilterKey[];
  defaults?: Partial<FilterValues>;
  labels?: Partial<Record<FilterKey, string>>;
  /** select seçenekleri (owner/customer/role/status/phase). department ve period otomatik. */
  options?: Partial<Record<FilterKey, FilterOption[]>>;
};

export const DEFAULT_FILTER_LABELS: Record<FilterKey, string> = {
  period: 'Dönem',
  from: 'Başlangıç',
  to: 'Bitiş',
  department: 'Departman',
  owner: 'Satıcı',
  customer: 'Müşteri',
  phase: 'Faz',
  role: 'Rol',
  status: 'Durum',
  q: 'Ara',
};

const token = z.string().trim().min(1).max(100);
const isoDate = z.iso.date();

const FIELD_SCHEMAS: Record<FilterKey, z.ZodType<string>> = {
  period: z.enum(PERIOD_PRESETS),
  from: isoDate,
  to: isoDate,
  department: z.enum(DEPARTMENTS),
  owner: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/),
  customer: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/),
  phase: z.string().trim().refine((v) => parsePhaseRange(v) !== null),
  role: token,
  status: token,
  q: z.string().trim().min(1).max(120),
};

export type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined> | null | undefined;

function readParam(sp: SearchParamsLike, key: string): string | undefined {
  if (!sp) return undefined;
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * URL → tipli filtre. Yalnız config.keys okunur; geçersiz değer düşürülür (default'a döner).
 * Departman: allowedDepartments doluysa izinsiz değer düşer; tek izinli departman zorla atanır.
 * options verilen select alanlarında (role/status/owner/customer) listede olmayan değer düşer.
 */
export function parseFilters(
  searchParams: SearchParamsLike,
  config: PageFilterConfig,
  ctx: { allowedDepartments?: Department[] | null } = {},
): FilterValues {
  const out: Record<string, string> = {};
  for (const key of config.keys) {
    const raw = readParam(searchParams, key);
    let value: string | undefined;
    if (raw !== undefined) {
      const res = FIELD_SCHEMAS[key].safeParse(raw);
      if (res.success) value = res.data;
    }
    const opts = config.options?.[key];
    if (value !== undefined && opts && key !== 'phase' && !opts.some((o) => o.value === value)) value = undefined;
    if (value === undefined) {
      const def = config.defaults?.[key];
      if (def !== undefined) value = def;
    }
    if (value !== undefined) out[key] = value;
  }

  if (config.keys.includes('department')) {
    const allowed = ctx.allowedDepartments ?? null;
    if (allowed && allowed.length) {
      const resolved = resolveDepartmentFilter(out.department, allowed);
      if (resolved && resolved.length === 1) out.department = resolved[0];
      else if (out.department && !allowed.includes(out.department as Department)) delete out.department;
    }
  }

  // from > to → ikisi de düşer
  if (out.from && out.to && out.from > out.to) { delete out.from; delete out.to; }
  if ((out.from || out.to) && config.keys.includes('period') && out.from && out.to) out.period = 'custom';

  return out as FilterValues;
}

/** Filtreyi URL query'ye çevirir (default'a eşit ve boş değerler yazılmaz). */
export function filtersToQuery(values: FilterValues, config: PageFilterConfig): URLSearchParams {
  const qs = new URLSearchParams();
  for (const key of config.keys) {
    const v = values[key];
    if (v === undefined || v === '') continue;
    if (config.defaults?.[key] === v) continue;
    qs.set(key, String(v));
  }
  return qs;
}

/** Default'tan farklı aktif filtre sayısı (from/to tek sayılır). */
export function countActiveFilters(values: FilterValues, config: PageFilterConfig): number {
  let n = 0;
  for (const key of config.keys) {
    if (key === 'to' && config.keys.includes('from')) continue;
    const v = key === 'from' ? values.from || values.to : values[key];
    if (v === undefined || v === '') continue;
    if (key !== 'from' && config.defaults?.[key] === v) continue;
    if (key === 'period' && v === 'custom' && config.keys.includes('from')) continue;
    n++;
  }
  return n;
}
