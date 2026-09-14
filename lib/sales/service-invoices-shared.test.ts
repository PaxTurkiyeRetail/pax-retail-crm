import { describe, expect, it } from 'vitest';
import {
  computeLineTotals,
  currentPeriod,
  fmtServiceMoney,
  missingFirms,
  normalizePeriodMonth,
  periodInputValue,
  periodLabel,
  previousPeriod,
  sumByCurrency,
} from './service-invoices-shared';

// Hizmet faturaları (032) — Sinan, 14.09: firma · ay (geçmiş de olur) · TL/USD · kalem × adet.

describe('hizmet faturası — dönem (ay)', () => {
  it("'YYYY-MM' ve 'YYYY-MM-DD' ayın 1'ine iner; geçersizler null", () => {
    expect(normalizePeriodMonth('2026-09')).toBe('2026-09-01');
    expect(normalizePeriodMonth('2026-09-17')).toBe('2026-09-01');
    expect(normalizePeriodMonth('2026-13')).toBeNull();
    expect(normalizePeriodMonth('2019-01')).toBeNull();
    expect(normalizePeriodMonth('eylül')).toBeNull();
    expect(normalizePeriodMonth('')).toBeNull();
  });
  it('etiket Türkçe kısa ay adı; input değeri YYYY-MM', () => {
    expect(periodLabel('2026-09-01')).toBe('Eyl 2026');
    expect(periodLabel('2026-01-01')).toBe('Oca 2026');
    expect(periodInputValue('2026-09-01')).toBe('2026-09');
  });
  it('önceki ay yıl sınırını geçer; içinde bulunulan ay gün anahtarından', () => {
    expect(previousPeriod('2026-01-01')).toBe('2025-12-01');
    expect(previousPeriod('2026-09-01')).toBe('2026-08-01');
    expect(currentPeriod('2026-09-14')).toBe('2026-09-01');
  });
});

describe('hizmet faturası — kalem hesabı', () => {
  it('satır toplamı adet × birim fiyat; fatura tutarı satırların toplamı (kuruş yuvarlanır)', () => {
    const result = computeLineTotals([
      { service_key: 'KasaPOS Entegrasyonu + TMS', quantity: 9, unit_price: 1250 },
      { service_key: 'AirViewer Kullanim', quantity: 2, unit_price: 400.5 },
    ]);
    expect(result.lines.map((line) => line.total_price)).toEqual([11250, 801]);
    expect(result.amount).toBe(12051);
  });
  it('adet ≤ 0 ya da hizmeti boş satır düşer; hiç satır kalmazsa tutar 0', () => {
    const result = computeLineTotals([
      { service_key: '', quantity: 3, unit_price: 10 },
      { service_key: 'X', quantity: 0, unit_price: 10 },
      { service_key: 'Y', quantity: 2.9, unit_price: 10 }, // adet tam sayıya iner
    ]);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(2);
    expect(result.amount).toBe(20);
    expect(computeLineTotals([]).amount).toBe(0);
  });
  it('kuruş hassasiyeti: 0.1 + 0.2 sorunu yok', () => {
    expect(computeLineTotals([{ service_key: 'A', quantity: 3, unit_price: 0.1 }]).amount).toBe(0.3);
  });
});

describe('hizmet faturası — para birimi', () => {
  it('TL ve USD ayrı toplanır, karışmaz', () => {
    const totals = sumByCurrency([
      { currency: 'TRY', amount: 100 }, { currency: 'USD', amount: 40 }, { currency: 'TRY', amount: 50.25 },
    ]);
    expect(totals.TRY).toEqual({ count: 2, amount: 150.25 });
    expect(totals.USD).toEqual({ count: 1, amount: 40 });
  });
  it('biçim: ₺ / $ öneki, binlik nokta, kuruş yalnız varsa', () => {
    expect(fmtServiceMoney(12051, 'TRY')).toBe('₺12.051');
    expect(fmtServiceMoney(400.5, 'USD')).toBe('$400,50');
    expect(fmtServiceMoney(0, 'TRY')).toBe('₺0');
  });
});

describe('hizmet faturası — "her ay kesilmesi zorunlu"', () => {
  const prev = [
    { customer_id: 'a', musteri: 'Beymen', owner_name: 'Furkan', period_month: '2026-08-01', amount: 300, currency: 'TRY' as const },
    { customer_id: 'a', musteri: 'Beymen', owner_name: 'Furkan', period_month: '2026-08-01', amount: 200, currency: 'TRY' as const },
    { customer_id: 'b', musteri: 'Suwen', owner_name: 'Furkan', period_month: '2026-08-01', amount: 900, currency: 'USD' as const },
    { customer_id: 'c', musteri: 'Dagi', owner_name: 'Erdi', period_month: '2026-08-01', amount: 50, currency: 'TRY' as const },
  ];
  it('geçen ay faturası olup bu ay olmayan firmalar; aynı firmanın faturaları toplanır; tutara göre sıralı', () => {
    const missing = missingFirms(prev, [{ customer_id: 'c' }]);
    expect(missing.map((row) => row.musteri)).toEqual(['Suwen', 'Beymen']);
    expect(missing.find((row) => row.customer_id === 'a')?.last_amount).toBe(500);
  });
  it('bu ay herkesin faturası varsa liste boş', () => {
    expect(missingFirms(prev, [{ customer_id: 'a' }, { customer_id: 'b' }, { customer_id: 'c' }])).toEqual([]);
  });
});
