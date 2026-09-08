import { describe, expect, it } from 'vitest';
import { priceLine, rentalMonths, sumLineTotals } from './line-pricing';

const rules = [
  { product_id: 'p1', min_qty: 1, max_qty: 99, unit_price: 200 },
  { product_id: 'p1', min_qty: 100, max_qty: null, unit_price: 160 },
];

describe('line pricing', () => {
  it('prices sale lines from the tier that matches the quantity', () => {
    expect(priceLine({ product_id: 'p1', quantity: 50 }, rules).total_price).toBe(10_000);
    expect(priceLine({ product_id: 'p1', quantity: 100 }, rules).total_price).toBe(16_000);
    expect(priceLine({ product_id: 'p1', quantity: 100 }, rules).rule_label).toBe('100+');
    expect(priceLine({ product_id: 'p1', quantity: 5 }, []).priced).toBe(false);
  });
  it('counts rental months from the period (min 1, ~30.44 days per month)', () => {
    expect(rentalMonths('2026-10-01', '2027-09-30')).toBe(12);
    expect(rentalMonths('2026-10-01', '2026-10-15')).toBe(1);
    expect(rentalMonths('2026-10-01', '2026-10-01')).toBe(0);
    expect(rentalMonths('2026-10-01', null)).toBe(0);
  });
  it('prices rental lines as monthly unit × qty × months and never from the catalog tier', () => {
    const line = priceLine({ product_id: 'p1', quantity: 100, sale_type: 'rental', rental_start_date: '2026-10-01', rental_end_date: '2027-09-30', rental_monthly_price: 15 }, rules);
    expect(line.rule).toBeNull();
    expect(line.rental_months).toBe(12);
    expect(line.monthly_total).toBe(1_500);
    expect(line.total_price).toBe(18_000);
    expect(line.priced).toBe(true);
  });
  it('prices a dateless rental from the catalog tariff as a monthly amount (08.09: A80 15 $/ay)', () => {
    const a80 = { id: 'a80', product_type: 'device', is_recurring: false, rental_monthly_price: 15 };
    const line = priceLine({ product_id: 'a80', quantity: 200, sale_type: 'rental' }, [], a80);
    expect(line.priced).toBe(true);
    expect(line.unit_price).toBe(15);
    expect(line.monthly_total).toBe(3_000);
    expect(line.total_price).toBe(3_000);      // tarih yok → aylık tutar
    expect(line.rental_months).toBe(0);
    expect(line.rental_from_catalog).toBe(true);
    expect(line.rule_label).toMatch(/katalog/);
  });
  it('lets the line override the catalog tariff (anlaşma kirası)', () => {
    const a80 = { id: 'a80', product_type: 'device', is_recurring: false, rental_monthly_price: 15 };
    const line = priceLine({ product_id: 'a80', quantity: 10, sale_type: 'rental', rental_monthly_price: 12.5 }, [], a80);
    expect(line.unit_price).toBe(12.5);
    expect(line.rental_from_catalog).toBe(false);
    expect(line.total_price).toBe(125);
  });
  it('reports what is missing on an unpriceable rental line', () => {
    // Tarifesi olmayan ürün, elle kira da yok → fiyatlanamaz; tarih artık zorunlu değil.
    const noTariff = { id: 'p1', product_type: 'device', is_recurring: false, rental_monthly_price: null };
    expect(priceLine({ product_id: 'p1', quantity: 10, sale_type: 'rental' }, rules, noTariff).problem).toMatch(/tarife/);
    expect(priceLine({ product_id: 'p1', quantity: 10, sale_type: 'rental' }, rules).problem).toMatch(/tarife/);
    // Eski kayıt: tarih verilmişse tersliği hâlâ yakalar.
    expect(priceLine({ product_id: 'p1', quantity: 10, sale_type: 'rental', rental_start_date: '2026-10-01', rental_end_date: '2026-09-01', rental_monthly_price: 10 }, rules).problem).toMatch(/sonra/);
  });
  it('keeps dateless rental out of the contract value but in total + monthly', () => {
    const a80 = { id: 'a80', product_type: 'device', is_recurring: false, rental_monthly_price: 15 };
    const totals = sumLineTotals([
      { quantity: 100, product: a80, priced: priceLine({ product_id: 'a80', quantity: 100 }, [{ product_id: 'a80', min_qty: 1, max_qty: null, unit_price: 160 }], a80) },
      { quantity: 40, product: a80, priced: priceLine({ product_id: 'a80', quantity: 40, sale_type: 'rental' }, [], a80) },
    ]);
    expect(totals.totalDevices).toBe(140);
    expect(totals.hardwareAmount).toBe(16_000);
    expect(totals.rentalAmount).toBe(0);           // sözleşme değeri yok (tarih yok)
    expect(totals.monthlyAmount).toBe(600);        // 15 × 40
    expect(totals.totalAmount).toBe(16_600);       // donanım + aylık kira (aylık kalem gibi)
  });
  it('splits totals: rental devices count as devices, rental value goes to total + monthly, not hardware', () => {
    const device = { id: 'p1', product_type: 'device', is_recurring: false };
    const service = { id: 's1', product_type: 'recurring', is_recurring: true };
    const totals = sumLineTotals([
      { quantity: 100, product: device, priced: priceLine({ product_id: 'p1', quantity: 100 }, rules) },
      { quantity: 50, product: device, priced: priceLine({ product_id: 'p1', quantity: 50, sale_type: 'rental', rental_start_date: '2026-10-01', rental_end_date: '2027-09-30', rental_monthly_price: 10 }, rules) },
      { quantity: 150, product: service, priced: priceLine({ product_id: 's1', quantity: 150 }, [{ product_id: 's1', min_qty: 1, max_qty: null, unit_price: 2 }]) },
    ]);
    expect(totals.totalDevices).toBe(150);
    expect(totals.hardwareAmount).toBe(16_000);
    expect(totals.rentalAmount).toBe(6_000);
    expect(totals.monthlyAmount).toBe(500 + 300);
    expect(totals.totalAmount).toBe(16_000 + 6_000 + 300);
  });
});
