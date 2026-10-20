import { describe, expect, it } from 'vitest';
import type { RetailOpportunity, RetailSaleLine } from './retail-operasyon';
import { businessType, projectRetail } from './retail-projection';

const actual: RetailSaleLine[] = [{ firm: 'Actual customer', model: 'A80', month: 1, qty: 2, usd: 40, usdQty: 2, saleType: 'sale' }];
const native = (patch: Partial<RetailOpportunity> = {}): RetailOpportunity => ({ id: 'canonical-forecast', customerId: 'canonical-customer', productId: 'canonical-product', firm: 'Live customer', model: 'A80', qty: 3, month: 2, channel: 'Direkt Satis', prob: 30, note: '', owner: 'Current Account', source: 'forecast', saleType: 'sale', unitPrice: 20, includeInRetailPlan: true, ...patch });

describe('Retail native source changes reach derived results', () => {
  it('keeps current-year Forecast in its stored month and moves only its plan contribution after an edit', () => {
    const first = projectRetail(actual, [native()], 100, true);
    expect(first.groups.find(g => g.model === 'A80')?.planMonths).toEqual([0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const edited = projectRetail(actual, [native({ month: 5, qty: 6 })], 100, true);
    expect(edited.groups.find(g => g.model === 'A80')?.planMonths).toEqual([0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0]);
    expect(edited.actualQty).toBe(first.actualQty);
    expect(edited.saleUsd).toBe(120);
    expect(edited.groups[0].actualMonths).toEqual(first.groups[0].actualMonths);
  });
  it('changes model and price from the edited native record without a reference label or tariff', () => {
    const result = projectRetail([], [native({ model: 'A35', unitPrice: 27, qty: 4, month: 7 })], 100, false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ model: 'A35', saleQty: 4, saleUsd: 108 });
    expect(result.groups[0].planMonths[6]).toBe(4);
  });
  it('uses native sale type and channel independently; bank-channel rental stays rental', () => {
    expect(businessType(native({ channel: 'Banka' }))).toBe('bank');
    expect(businessType(native({ channel: 'Banka', saleType: 'rental' }))).toBe('rental');
    const sale = projectRetail([], [native({ qty: 10 })], 100, false);
    const rental = projectRetail([], [native({ qty: 10, saleType: 'rental', rentalMonthlyPrice: 17 })], 100, false);
    expect(sale).toMatchObject({ saleQty: 10, leaseQty: 0, saleUsd: 200 });
    expect(rental).toMatchObject({ saleQty: 0, leaseQty: 10, leaseUsd: 170 });
  });
  it('removes disabled plan contribution while keeping actual sales and does not weight by probability', () => {
    const high = projectRetail(actual, [native({ prob: 90 })], 100, true);
    const low = projectRetail(actual, [native({ prob: 30 })], 100, true);
    expect(low.planQty).toBe(high.planQty);
    expect(projectRetail(actual, [native({ includeInRetailPlan: false })], 100, true)).toMatchObject({ actualQty: 2, planQty: 0 });
  });
});
