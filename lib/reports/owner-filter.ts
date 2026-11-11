// Satıcı (owner) filtresi seçenekleri — saf fonksiyonlar (istemci + sunucu).
// Değer: kullanıcı id (allowed_users.id). Hesabı olmayan satış ekibi üyeleri ve
// havuz/grup sahipleri ad-anahtarlı (`n-<slug>`) değerle 'Havuz / Gruplar' altında listelenir.
import type { FilterOption } from '@/lib/filters/schema';
import { trFold } from '@/lib/filters/sql';
import { OWNER_ORDER, PSEUDO_OWNERS, normalizeName, ownerOrderCompare } from '@/lib/reports/live-board-shared';

export const OWNER_GROUP_LABEL = 'Havuz / Gruplar';

export type OwnerUser = { id: string; name: string };
export type ResolvedOwner = { value: string; id: string | null; name: string };

/** 'Havuz Account' → 'n-havuz-account' (FilterBar owner regex'ine uyar). */
export function ownerNameKey(name: string): string {
  const slug = trFold(name.normalize('NFC')).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `n-${slug || 'x'}`;
}

/**
 * Seçenek listesi: önce kişiler (OWNER_ORDER sırası, sonra alfabetik), sonra 'Havuz / Gruplar'.
 * opts.includePseudo=false → havuz/grup sahipleri eklenmez (ör. hareketsiz firmalar).
 */
export function buildOwnerOptions(users: OwnerUser[], opts: { includePseudo?: boolean; extraNames?: readonly string[] } = {}): FilterOption[] {
  const seen = new Set<string>();
  const people: FilterOption[] = [];
  for (const u of users) {
    const name = u.name.trim();
    const key = normalizeName(name);
    if (!u.id || !name || seen.has(key) || PSEUDO_OWNERS.some((p) => normalizeName(p) === key)) continue;
    seen.add(key);
    people.push({ value: u.id, label: name });
  }
  // Hesabı olmayan satış ekibi üyeleri (OWNER_ORDER) ve verideki ek adlar ad-anahtarıyla kişi olarak eklenir.
  for (const name of [...OWNER_ORDER, ...(opts.extraNames ?? [])]) {
    const key = normalizeName(name);
    if (!name.trim() || seen.has(key) || PSEUDO_OWNERS.some((p) => normalizeName(p) === key)) continue;
    seen.add(key);
    people.push({ value: ownerNameKey(name), label: name.trim() });
  }
  people.sort((a, b) => ownerOrderCompare(a.label, b.label));
  const groups: FilterOption[] = opts.includePseudo === false
    ? []
    : PSEUDO_OWNERS.map((name) => ({ value: ownerNameKey(name), label: name, group: OWNER_GROUP_LABEL }));
  return [...people, ...groups];
}

/** Seçili değeri {id, ad} olarak çözer; listede yoksa null. Ad-anahtarlı seçeneklerde id null. */
export function resolveOwner(value: string | null | undefined, options: FilterOption[]): ResolvedOwner | null {
  if (!value) return null;
  const hit = options.find((o) => o.value === value);
  if (!hit) return null;
  return { value: hit.value, id: hit.value.startsWith('n-') ? null : hit.value, name: hit.label };
}

/** Eski linklerdeki ad parametresini (?satici=Ad) seçenek değerine çevirir. */
export function ownerValueFromName(name: string | null | undefined, options: FilterOption[]): string | undefined {
  const key = normalizeName(String(name ?? ''));
  if (!key) return undefined;
  return options.find((o) => normalizeName(o.label) === key)?.value;
}
