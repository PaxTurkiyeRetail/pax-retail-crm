import { describe, expect, it } from 'vitest';
import { checkSaleAmounts } from './amount-check';

describe('checkSaleAmounts', () => {
  it('tutarlı satışta uyarı yok', () => {
    expect(checkSaleAmounts({ amount: 2500, items: [{ product_code: 'A80', quantity: 10, unit_price: 250, total_price: 2500 }] })).toEqual([]);
  });

  it('MAD Parfüm vakası: 258 adet $753 → cihaz başı uyarısı', () => {
    const w = checkSaleAmounts({ amount: 753, items: [{ product_code: 'A80', quantity: 258, unit_price: 250, total_price: 64500 }] });
    expect(w.some((x) => x.includes('Cihaz başı'))).toBe(true);
    expect(w.some((x) => x.includes('kalemlerin toplamı'))).toBe(true);
  });

  it('kalem birim × adet ≠ toplam → uyarı', () => {
    const w = checkSaleAmounts({ amount: 900, items: [{ product_code: 'A80', quantity: 10, unit_price: 250, total_price: 900 }] });
    expect(w[0]).toContain('A80');
  });

  it('kiralama kalemi birim × adet kontrolünden muaf', () => {
    expect(checkSaleAmounts({ amount: 1800, items: [{ product_code: 'A80', quantity: 10, unit_price: 15, total_price: 1800, sale_type: 'rental' }] })).toEqual([]);
  });

  it('kalemsiz satışta adet/tutar oranı', () => {
    expect(checkSaleAmounts({ amount: 753, deviceCount: 258, items: [] }).length).toBe(1);
    expect(checkSaleAmounts({ amount: 50000, deviceCount: 258, items: [] })).toEqual([]);
  });

  it('küçük yuvarlama farkı tolere edilir', () => {
    expect(checkSaleAmounts({ amount: 2502, items: [{ quantity: 10, unit_price: 250, total_price: 2501 }] })).toEqual([]);
  });
});
