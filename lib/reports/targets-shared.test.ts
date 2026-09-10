import { describe, expect, it } from 'vitest';
import {
  QUARTERLY_TARGET_CODES,
  TARGET_CODES,
  goalPair,
  isTargetOwnerName,
  normalizeTargetValue,
  quarterElapsedPct,
  quarterOf,
  quarterRange,
  targetYearOf,
} from './targets-shared';
import { msUntilIstanbulTime } from './live-board-shared';

describe('hedefler v2 — çeyrek yardımcıları', () => {
  it('quarterRange doğru gün anahtarlarını verir', () => {
    expect(quarterRange(2026, 1)).toMatchObject({ label: 'Q1', start: '2026-01-01', end: '2026-03-31' });
    expect(quarterRange(2026, 2)).toMatchObject({ label: 'Q2', start: '2026-04-01', end: '2026-06-30' });
    expect(quarterRange(2026, 3)).toMatchObject({ label: 'Q3', start: '2026-07-01', end: '2026-09-30', months: 'Tem–Eyl' });
    expect(quarterRange(2026, 4)).toMatchObject({ label: 'Q4', start: '2026-10-01', end: '2026-12-31' });
  });

  it('quarterOf: 10 Eylül Q3, 1 Ocak Q1, 31 Aralık Q4', () => {
    expect(quarterOf('2026-09-10').index).toBe(3);
    expect(quarterOf('2026-01-01').index).toBe(1);
    expect(quarterOf('2026-12-31').index).toBe(4);
    expect(quarterOf('2026-06-30').index).toBe(2);
  });

  it('quarterElapsedPct: çeyrek başı ~1, sonu 100, ortası ~50', () => {
    expect(quarterElapsedPct('2026-07-01')).toBe(1);
    expect(quarterElapsedPct('2026-09-30')).toBe(100);
    const mid = quarterElapsedPct('2026-08-15');
    expect(mid).toBeGreaterThan(45);
    expect(mid).toBeLessThan(55);
  });
});

describe('hedefler v2 — değer normalizasyonu', () => {
  it('boş / 0 / negatif → null (kayıt silinir)', () => {
    expect(normalizeTargetValue('')).toBeNull();
    expect(normalizeTargetValue(null)).toBeNull();
    expect(normalizeTargetValue(0)).toBeNull();
    expect(normalizeTargetValue('-5')).toBeNull();
    expect(normalizeTargetValue('abc')).toBeNull();
  });
  it('TR binlik/ondalık ve EN ondalık', () => {
    expect(normalizeTargetValue('1.500.000')).toBe(1500000);
    expect(normalizeTargetValue('1.500.000,60')).toBe(1500001);
    expect(normalizeTargetValue('1500.4')).toBe(1500);
    expect(normalizeTargetValue(' 400000 ')).toBe(400000);
    expect(normalizeTargetValue(12)).toBe(12);
  });
  it('targetYearOf sınırlar', () => {
    expect(targetYearOf('2026', 2030)).toBe(2026);
    expect(targetYearOf('1999', 2030)).toBe(2030);
    expect(targetYearOf(null, 2030)).toBe(2030);
  });
});

describe('hedefler v2 — goalPair ve kod listeleri', () => {
  it('hedef yoksa pct null; varsa yuvarlanmış yüzde', () => {
    expect(goalPair(9, null)).toEqual({ actual: 9, target: null, pct: null });
    expect(goalPair(9, 0)).toEqual({ actual: 9, target: null, pct: null });
    expect(goalPair(9, 30)).toEqual({ actual: 9, target: 30, pct: 30 });
    expect(goalPair(117000, 100000).pct).toBe(117);
  });
  it('çeyrek girilebilen kodlar yalnız bütçe ve ziyaret; 7 tanım', () => {
    expect(QUARTERLY_TARGET_CODES).toEqual(['sales_revenue', 'visit_count']);
    expect(TARGET_CODES).toHaveLength(7);
    expect(TARGET_CODES).toContain('hunter_to_farmer');
    expect(TARGET_CODES).toContain('lead_to_hunter');
    expect(TARGET_CODES).toContain('quotes_won_count');
  });
});

describe('hedefler v2 — kim hedef alır', () => {
  it('yalnız satış ekibi; yönetici hesabı (genel müdür) listeye girmez', () => {
    for (const name of ['Cem Koç', 'Ömer Canatar', 'Furkan Kızılkurt', 'Erdi Toraman', 'Seda Kesikoğlu']) {
      expect(isTargetOwnerName(name)).toBe(true);
    }
    // Sinan, 10.09 (iki kez): "Görkem İlbay olmasın direkt" — ikincil rolü account_manager olsa da,
    // migration 016 ona da haftalık 20 yazmış olsa da listede yok.
    expect(isTargetOwnerName('Görkem İlbay')).toBe(false);
    expect(isTargetOwnerName('Taha Bitim')).toBe(false);
    expect(isTargetOwnerName('')).toBe(false);
  });
  it('yazım farkı (büyük/küçük harf, Türkçe karakter) kişiyi düşürmez', () => {
    expect(isTargetOwnerName('ÖMER CANATAR')).toBe(true);
    expect(isTargetOwnerName(' cem koç ')).toBe(true); // normalizeName baş/son boşluğu da kırpar
  });
});

describe('Canlı Ekran — günlük 08:00 yenileme zamanlayıcısı', () => {
  it('İstanbul 07:30 → 30 dk; 08:30 → ertesi gün (23,5 saat)', () => {
    // 2026-09-10 04:30Z = 07:30 İstanbul (UTC+3)
    expect(msUntilIstanbulTime(new Date('2026-09-10T04:30:00Z'), 8, 0)).toBe(30 * 60_000);
    // 05:30Z = 08:30 İstanbul → yarın 08:00 = 23 saat 30 dk
    expect(msUntilIstanbulTime(new Date('2026-09-10T05:30:00Z'), 8, 0)).toBe((23 * 60 + 30) * 60_000);
  });
  it('tam 08:00 → yarın; asla 1 dk altına düşmez', () => {
    expect(msUntilIstanbulTime(new Date('2026-09-10T05:00:00Z'), 8, 0)).toBe(24 * 60 * 60_000);
    expect(msUntilIstanbulTime(new Date('2026-09-10T04:59:30Z'), 8, 0)).toBeGreaterThanOrEqual(60_000);
  });
});
