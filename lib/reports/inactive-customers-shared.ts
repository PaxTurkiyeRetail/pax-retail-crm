/**
 * HAREKETSİZ FİRMALAR — paylaşımlı tipler ve saf kurallar (sunucuya bağımlı değil).
 * Veri erişimi `inactive-customers.ts` içinde; burası istemci, Canlı Ekran ve vitest için.
 *
 * Çağdaş Bey, 11.09.2026: "Firma Hunter'da ya da Farmer'da olsun; 15 gündür üzerinde hareket
 * yoksa hareketsize dönsün… Basınca gitsin o firmaları göreyim, listesi açılsın… New Tab açsın."
 */
import { LIVE_BOARD_RULES, normalizeName } from './live-board-shared';

export type InactiveRow = {
  owner: string;
  ownerUserId: string | null;
  /** Yalnız Müşteri Listesi'nin Hunter ve Farmer kategorileri sayılır (Lead ve Kasa sayılmaz). */
  category: 'H' | 'F';
  firma: string;
  /** Eşleşen künye kaydı (varsa) — listede firma kartına bağlanır. */
  customerId: string | null;
  musteri: string | null;
  matched: boolean;
  lastActivityAt: string | null;
  /** Son hareketten bu yana geçen gün; hiç hareket yoksa null. */
  days: number | null;
};

/**
 * Bir satır hareketsiz mi?
 *   * Künyeyle EŞLEŞMEYEN satır sayılmaz — aktivitesi bilinemez, "0 gün" varsaymak yanlış olur.
 *   * Hiç hareketi olmayan (days null) eşleşmiş firma hareketsizdir.
 */
export function isInactiveRow(row: InactiveRow, days: number = LIVE_BOARD_RULES.inactiveOwnerDays): boolean {
  if (!row.matched) return false;
  return row.days == null || row.days >= days;
}

export type InactiveCounts = { count: number; unmatched: number };

/** Kişi (normalize ad) → hareketsiz firma sayısı + eşleşmeyen satır sayısı. */
export function inactiveCountsByOwner(
  rows: InactiveRow[],
  days: number = LIVE_BOARD_RULES.inactiveOwnerDays,
): Map<string, InactiveCounts> {
  const result = new Map<string, InactiveCounts>();
  for (const row of rows) {
    const key = normalizeName(row.owner);
    const cur = result.get(key) ?? { count: 0, unmatched: 0 };
    if (!row.matched) cur.unmatched += 1;
    else if (isInactiveRow(row, days)) cur.count += 1;
    result.set(key, cur);
  }
  return result;
}

/** Gün farkı (YYYY-MM-DD anahtarları); negatif olmaz varsayımı yoktur. */
export function dayDiffKeys(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* SIRALAMA — Çağdaş Bey, 15.09.2026: "hareketsiz firmalarda sıralama olmalı,   */
/* tarihe göre güne göre sıralama yapması lazım."                              */
/*                                                                            */
/* Sayfa sunucu bileşeni (TV'de açılıyor, istemci JS'i yok) → sıralama URL'den  */
/* okunur: ?sirala=gun&yon=desc. Başlıklara basınca aynı sayfa yeni sırayla     */
/* basılır. Kural saf tutuldu ki vitest'te doğrulanabilsin.                     */
/* -------------------------------------------------------------------------- */

export const INACTIVE_SORTS = ['gun', 'tarih', 'firma', 'kisi', 'kategori'] as const;
export type InactiveSort = (typeof INACTIVE_SORTS)[number];
export type InactiveSortDir = 'asc' | 'desc';

export function isInactiveSort(value: unknown): value is InactiveSort {
  return typeof value === 'string' && (INACTIVE_SORTS as readonly string[]).includes(value);
}

/** Varsayılan yön: gün ve tarih için "en uzun süredir hareketsiz" başa gelir. */
export const INACTIVE_SORT_DEFAULT_DIR: Record<InactiveSort, InactiveSortDir> = {
  gun: 'desc',
  tarih: 'asc',
  firma: 'asc',
  kisi: 'asc',
  kategori: 'asc',
};

/**
 * Hiç hareketi olmayan firma (days null / lastActivityAt null) EN HAREKETSİZ kabul edilir:
 * gün sıralamasında sonsuz, tarih sıralamasında en eski gibi davranır. Böylece "hiç
 * dokunulmamış" firmalar listenin dibinde kaybolmaz.
 */
const NEVER_DAYS = Number.POSITIVE_INFINITY;
const NEVER_DATE = '0000-00-00';

export function sortInactiveRows(
  rows: readonly InactiveRow[],
  sort: InactiveSort,
  dir: InactiveSortDir,
  ownerCompare: (a: string, b: string) => number = (a, b) => a.localeCompare(b, 'tr'),
): InactiveRow[] {
  const sign = dir === 'desc' ? -1 : 1;
  const byName = (a: InactiveRow, b: InactiveRow) => a.firma.localeCompare(b.firma, 'tr');
  const primary = (a: InactiveRow, b: InactiveRow): number => {
    switch (sort) {
      case 'gun': {
        const x = a.days ?? NEVER_DAYS;
        const y = b.days ?? NEVER_DAYS;
        return x === y ? 0 : x < y ? -1 : 1;
      }
      case 'tarih':
        return (a.lastActivityAt ?? NEVER_DATE).localeCompare(b.lastActivityAt ?? NEVER_DATE);
      case 'firma':
        return byName(a, b);
      case 'kisi':
        return ownerCompare(a.owner, b.owner);
      case 'kategori':
        return a.category.localeCompare(b.category);
    }
  };
  return [...rows].sort((a, b) => sign * primary(a, b) || byName(a, b));
}
