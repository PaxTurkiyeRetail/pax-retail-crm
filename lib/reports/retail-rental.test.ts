import { describe, expect, it } from 'vitest';
import { RENTAL_OPS_STATUSES, rentalOpsLabel } from '@/lib/sales/rental-ops';
import { summarizeRental, type RentalItemRow } from './retail-rental';

const order = RENTAL_OPS_STATUSES.map((s) => s.value);
const row = (p: Partial<RentalItemRow>): RentalItemRow => ({
  saleId: 's1', firm: 'Tespo', status: 'aktif', note: '', start: '2026-01-01', end: null, qty: 10, monthlyPrice: 15, ...p,
});

describe('summarizeRental', () => {
  it('gelecekte başlayacak aktif sözleşme bugünün gelirine girmez',()=>{
    const summary=summarizeRental([row({start:'2027-01-01'})],'2026-10-19',order,rentalOpsLabel);
    expect(summary.activeQty).toBe(0);expect(summary.monthlyRevenue).toBe(0);
    expect(summary.contracts).toHaveLength(1);
  });
  it('yalnız aktif ve süresi dolmamış kalemler gelire girer', () => {
    const s = summarizeRental([
      row({ qty: 10, monthlyPrice: 15 }),
      row({ saleId: 's2', firm: 'Ekol', status: 'sim_bekliyor', qty: 20, monthlyPrice: 20 }),
      row({ saleId: 's3', qty: 5, monthlyPrice: 10, end: '2026-01-31' }),
    ], '2026-10-19', order, rentalOpsLabel);
    expect(s.activeQty).toBe(10);
    expect(s.monthlyRevenue).toBe(150);
    expect(s.avgMonthlyPrice).toBe(15);
    expect(s.byStatus.find((b) => b.status === 'sim_bekliyor')).toMatchObject({ contracts: 1, qty: 20, monthly: 400 });
    expect(s.contracts[0].firm).toBe('Ekol');
  });

  it('kiralama yoksa ortalama null', () => {
    const s = summarizeRental([], '2026-10-19', order, rentalOpsLabel);
    expect(s).toMatchObject({ activeQty: 0, monthlyRevenue: 0, avgMonthlyPrice: null, contracts: [] });
    expect(s.byStatus).toHaveLength(6);
  });
});
