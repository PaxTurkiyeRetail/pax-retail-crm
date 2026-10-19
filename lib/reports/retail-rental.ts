// Retail paneli kiralama özeti — saf hesap (test edilir). Kaynak satırı: crm_sale_items (rental) + crm_sales.rental_ops_status.
import type { RentalOpsStatus } from '@/lib/sales/rental-ops';
import type { RetailRentalContract, RetailRentalSummary } from './retail-operasyon';

export type RentalItemRow = {
  saleId: string; firm: string; status: RentalOpsStatus; note: string;
  start: string | null; end: string | null; qty: number; monthlyPrice: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Aktif: operasyon 'aktif' ve kira dönemi bitmemiş (bitiş boş ya da bugün/sonrası). */
export function isActiveRental(row: Pick<RentalItemRow, 'status' | 'end'> & { start?: string | null }, today: string) {
  return row.status === 'aktif' && (!row.start || row.start.slice(0,10) <= today) && (!row.end || row.end.slice(0, 10) >= today);
}

export function summarizeRental(
  rows: RentalItemRow[],
  today: string,
  statusOrder: readonly RentalOpsStatus[],
  label: (s: RentalOpsStatus) => string,
): RetailRentalSummary {
  let activeQty = 0;
  let monthlyRevenue = 0;
  const byStatus = new Map(statusOrder.map((s) => [s, { status: s, label: label(s), contracts: new Set<string>(), qty: 0, monthly: 0 }]));
  const contracts = new Map<string, RetailRentalContract>();

  for (const row of rows) {
    const monthly = row.qty * row.monthlyPrice;
    if (isActiveRental(row, today)) {
      activeQty += row.qty;
      monthlyRevenue += monthly;
    }
    const bucket = byStatus.get(row.status);
    if (bucket) { bucket.contracts.add(row.saleId); bucket.qty += row.qty; bucket.monthly += monthly; }
    const c = contracts.get(row.saleId) ?? {
      saleId: row.saleId, firm: row.firm, status: row.status, statusLabel: label(row.status), note: row.note,
      qty: 0, monthly: 0, start: row.start, end: row.end,
    };
    c.qty += row.qty;
    c.monthly = r2(c.monthly + monthly);
    if (row.start && (!c.start || row.start < c.start)) c.start = row.start;
    if (row.end && (!c.end || row.end > c.end)) c.end = row.end;
    contracts.set(row.saleId, c);
  }

  return {
    activeQty,
    monthlyRevenue: r2(monthlyRevenue),
    avgMonthlyPrice: activeQty > 0 ? r2(monthlyRevenue / activeQty) : null,
    byStatus: [...byStatus.values()].map((b) => ({ status: b.status, label: b.label, contracts: b.contracts.size, qty: b.qty, monthly: r2(b.monthly) })),
    contracts: [...contracts.values()].sort((a, b) => b.qty - a.qty),
  };
}
