import { describe, expect, it } from 'vitest';
import {
  NEAR_TERM_MONTH_WINDOW,
  SELLER_FOLLOWUP_PAGE_SIZE,
  formatModelAdet,
  nearTermBoundary,
  nearTermRangeLabel,
} from './seller-followup-shared';

describe('seller followup report constants', () => {
  it('lists 10 companies per page (görselde bir sayfada 10 firma)', () => {
    expect(SELLER_FOLLOWUP_PAGE_SIZE).toBe(10);
  });

  it('uses a three-month near-term window including the current month', () => {
    expect(NEAR_TERM_MONTH_WINDOW).toBe(3);
  });
});

describe('nearTermBoundary', () => {
  it('returns the last day of the third month counting from the current one', () => {
    // 1 Eylül 2026 → pencere Eylül, Ekim, Kasım → 30 Kasım 2026
    const boundary = nearTermBoundary(new Date(2026, 8, 1));
    expect(boundary.getFullYear()).toBe(2026);
    expect(boundary.getMonth()).toBe(10); // Kasım
    expect(boundary.getDate()).toBe(30);
  });

  it('rolls over the year end correctly', () => {
    // 15 Kasım 2026 → Kasım, Aralık, Ocak → 31 Ocak 2027
    const boundary = nearTermBoundary(new Date(2026, 10, 15));
    expect(boundary.getFullYear()).toBe(2027);
    expect(boundary.getMonth()).toBe(0);
    expect(boundary.getDate()).toBe(31);
  });

  it('handles February in a leap year', () => {
    // 10 Aralık 2027 → Aralık, Ocak, Şubat → 29 Şubat 2028 (artık yıl)
    const boundary = nearTermBoundary(new Date(2027, 11, 10));
    expect(boundary.getMonth()).toBe(1);
    expect(boundary.getDate()).toBe(29);
  });
});

describe('nearTermRangeLabel', () => {
  it('labels the window with Turkish month names', () => {
    expect(nearTermRangeLabel(new Date(2026, 8, 1))).toBe('Eylül–Kasım');
  });

  it('wraps around the year boundary', () => {
    expect(nearTermRangeLabel(new Date(2026, 11, 5))).toBe('Aralık–Şubat');
  });
});

describe('formatModelAdet', () => {
  it('formats models as "KOD: adet" joined with commas', () => {
    expect(formatModelAdet([
      { productCode: 'A80', productName: 'A80', quantity: 121 },
      { productCode: 'S210', productName: 'S210', quantity: 121 },
    ])).toBe('A80: 121, S210: 121');
  });

  it('groups thousands with the Turkish separator', () => {
    expect(formatModelAdet([{ productCode: 'A80', productName: 'A80', quantity: 1300 }])).toBe('A80: 1.300');
  });

  it('returns a dash when there is no forecast line', () => {
    expect(formatModelAdet([])).toBe('—');
  });
});
