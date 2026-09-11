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
