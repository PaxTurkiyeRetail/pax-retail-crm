import { describe, expect, it } from 'vitest';
import { LIVE_BOARD_RULES, capacities, normalizeName } from './live-board-shared';
import { dayDiffKeys, inactiveCountsByOwner, isInactiveRow, type InactiveRow } from './inactive-customers-shared';

// Hareketsiz firma kuralı — Çağdaş Bey, 11.09.2026 toplantısı.
// "Firma Hunter'da ya da Farmer'da olsun; 15 gündür üzerinde hareket yoksa hareketsize dönsün."

function row(over: Partial<InactiveRow> = {}): InactiveRow {
  return {
    owner: 'Furkan Kızılkurt',
    ownerUserId: null,
    category: 'H',
    firma: 'ACME',
    customerId: 'c1',
    musteri: 'ACME',
    matched: true,
    lastActivityAt: '2026-09-01',
    days: 10,
    ...over,
  };
}

describe('hareketsiz firma — eşik', () => {
  it('eşik varsayılanı 15 gün (toplantı kararı)', () => {
    expect(LIVE_BOARD_RULES.inactiveOwnerDays).toBe(15);
  });

  it('15 günden az → hareketli; 15 ve fazlası → hareketsiz', () => {
    expect(isInactiveRow(row({ days: 14 }))).toBe(false);
    expect(isInactiveRow(row({ days: 15 }))).toBe(true);
    expect(isInactiveRow(row({ days: 90 }))).toBe(true);
  });

  it('hiç hareketi olmayan firma hareketsizdir', () => {
    expect(isInactiveRow(row({ days: null, lastActivityAt: null }))).toBe(true);
  });

  it('künyeyle eşleşmeyen liste satırı SAYILMAZ (aktivitesi bilinemez)', () => {
    expect(isInactiveRow(row({ matched: false, customerId: null, days: null }))).toBe(false);
  });

  it('eşik parametrik: 7 gün istenirse 10 gün hareketsiz olur', () => {
    expect(isInactiveRow(row({ days: 10 }), 7)).toBe(true);
    expect(isInactiveRow(row({ days: 10 }), 30)).toBe(false);
  });
});

describe('hareketsiz firma — kişi bazında sayım', () => {
  const rows: InactiveRow[] = [
    row({ days: 40 }),                                        // hareketsiz
    row({ days: 2, firma: 'B' }),                             // hareketli
    row({ days: null, lastActivityAt: null, firma: 'C' }),    // hareketsiz (hiç hareket yok)
    row({ matched: false, customerId: null, firma: 'D', days: null }), // eşleşmedi
    row({ owner: 'Cem Koç', days: 30, firma: 'E' }),          // başka kişi
  ];

  it('kişi başına hareketsiz ve eşleşmeyen satır sayısı', () => {
    const counts = inactiveCountsByOwner(rows);
    expect(counts.get(normalizeName('Furkan Kızılkurt'))).toEqual({ count: 2, unmatched: 1 });
    expect(counts.get(normalizeName('Cem Koç'))).toEqual({ count: 1, unmatched: 0 });
  });

  it('ad yazımı farkı kişiyi bölmez (Canlı Ekran ile aynı normalize)', () => {
    const counts = inactiveCountsByOwner([row({ owner: 'FURKAN KIZILKURT', days: 20 }), row({ days: 20, firma: 'X' })]);
    expect(counts.size).toBe(1);
    expect(counts.get(normalizeName('Furkan Kızılkurt'))?.count).toBe(2);
  });
});

describe('gün farkı', () => {
  it('gün anahtarları arasındaki farkı verir (ay ve yıl sınırları dahil)', () => {
    expect(dayDiffKeys('2026-09-01', '2026-09-11')).toBe(10);
    expect(dayDiffKeys('2026-08-25', '2026-09-11')).toBe(17);
    expect(dayDiffKeys('2025-12-31', '2026-01-01')).toBe(1);
  });
});

describe('kişi slaydı model listesi kapasitesi (v2.9)', () => {
  it('kompakt ekranda az, büyük ekranda çok satır', () => {
    expect(capacities(1000, 1920).ownerModels).toBe(6);
    // 780 px altı = kompakt ölçüler (1366×768 dizüstü) — model listesine ~65 px kalır.
    expect(capacities(694, 1366).ownerModels).toBe(2);
  });
  it('Son Hareketler kutusu en fazla 5 satır (Çağdaş Bey: "1, 2, 3, 4, 5 gibi")', () => {
    expect(capacities(1000, 1920).recent).toBeLessThanOrEqual(5);
    expect(capacities(694, 1366).recent).toBeGreaterThanOrEqual(1);
  });
});
