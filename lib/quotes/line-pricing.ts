// Teklif satırı fiyatlama — istemci (QuoteBuilder / QuoteDetail) ve sunucu
// (resolveQuoteLines) AYNI hesabı kullanır; iki tarafın ayrışması "ekranda başka,
// kayıtta başka tutar" hatasına yol açıyordu.
//
// Satış tipi (08.09 satış ekibi isteği):
//   'sale'   → katalog kademesi (quote_pricing_rules): birim × adet.
//   'rental' → KİRALAMA. Katalogda kira tarifesi yok; aylık birim kira elle girilir.
//              Satır tutarı = aylık birim kira × adet × ay (başlangıç–bitiş tarihinden).
//              Aylık kira "Aylık recurring" toplamına, sözleşme değeri teklif tutarına yazılır.

export type SaleType = 'sale' | 'rental';

export type LineDraft = {
  product_id: string;
  quantity: number;
  sale_type?: SaleType | null;
  rental_start_date?: string | null;
  rental_end_date?: string | null;
  /** Aylık birim kira (USD). Sadece kiralama satırında. */
  rental_monthly_price?: number | null;
};

export type PricingRuleLike = { product_id: string; min_qty: number; max_qty: number | null; unit_price: number };
export type ProductLike = { id: string; product_type: string; is_recurring: boolean };

export type PricedLine = {
  sale_type: SaleType;
  /** Eşleşen kademe (satış) — kiralamada null. */
  rule: PricingRuleLike | null;
  rule_label: string;
  unit_price: number;
  total_price: number;
  /** Kiralama süresi (ay) — satışta 0. */
  rental_months: number;
  /** Kiralama satırının aylık toplamı (birim kira × adet) — satışta 0. */
  monthly_total: number;
  /** Fiyatlanabildi mi (kademe bulundu / kira bedeli ve tarihler tam). */
  priced: boolean;
  problem: string | null;
};

export function normalizeSaleType(value: unknown): SaleType {
  return value === 'rental' ? 'rental' : 'sale';
}

/** Kiralama süresi ay olarak: tarih farkı / 30,44 gün, en az 1 ay; tarih eksik/tersse 0. */
export function rentalMonths(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(`${String(start).slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${String(end).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return 0;
  return Math.max(1, Math.round(days / 30.4375));
}

export function findRule(rules: PricingRuleLike[], quantity: number): PricingRuleLike | null {
  return [...rules]
    .sort((a, b) => a.min_qty - b.min_qty)
    .find((rule) => quantity >= rule.min_qty && (rule.max_qty == null || quantity <= rule.max_qty)) ?? null;
}

export function priceLine(draft: LineDraft, rules: PricingRuleLike[]): PricedLine {
  const quantity = Math.max(0, Math.floor(Number(draft.quantity ?? 0)));
  const saleType = normalizeSaleType(draft.sale_type);
  if (saleType === 'rental') {
    const months = rentalMonths(draft.rental_start_date, draft.rental_end_date);
    const monthly = Number(draft.rental_monthly_price ?? 0);
    const monthlyOk = Number.isFinite(monthly) && monthly > 0;
    const problem = !draft.rental_start_date || !draft.rental_end_date
      ? 'Kiralama için başlangıç ve bitiş tarihi girilmeli.'
      : months <= 0
        ? 'Kiralama bitiş tarihi başlangıçtan sonra olmalı.'
        : !monthlyOk
          ? 'Kiralama için aylık birim kira bedeli girilmeli.'
          : null;
    const monthlyTotal = monthlyOk ? monthly * quantity : 0;
    return {
      sale_type: 'rental',
      rule: null,
      rule_label: months > 0 ? `${months} ay kiralama` : 'kiralama',
      unit_price: monthlyOk ? monthly : 0,
      total_price: problem ? 0 : round2(monthlyTotal * months),
      rental_months: months,
      monthly_total: round2(monthlyTotal),
      priced: !problem,
      problem,
    };
  }
  const rule = findRule(rules, quantity);
  return {
    sale_type: 'sale',
    rule,
    rule_label: rule ? `${rule.min_qty}${rule.max_qty ? `-${rule.max_qty}` : '+'}` : '-',
    unit_price: rule ? Number(rule.unit_price) : 0,
    total_price: rule ? round2(Number(rule.unit_price) * quantity) : 0,
    rental_months: 0,
    monthly_total: 0,
    priced: Boolean(rule),
    problem: rule ? null : 'Bu adet için fiyat kademesi bulunamadı.',
  };
}

export type LineTotals = { totalDevices: number; totalAmount: number; monthlyAmount: number; hardwareAmount: number; rentalAmount: number };

/**
 * Teklif toplamları.
 *  - totalDevices: tekrarlayan hizmet dışındaki satırların adedi (kiralanan cihaz da cihazdır).
 *  - totalAmount: satış satırları + kiralama sözleşme değeri (teklifin toplam değeri).
 *  - monthlyAmount: aylık hizmetler + aylık kira toplamı.
 *  - hardwareAmount: tek seferlik satış satırları (donanım).
 *  - rentalAmount: kiralama sözleşme değeri.
 */
export function sumLineTotals(lines: Array<{ quantity: number; product: ProductLike | null; priced: PricedLine }>): LineTotals {
  const totals: LineTotals = { totalDevices: 0, totalAmount: 0, monthlyAmount: 0, hardwareAmount: 0, rentalAmount: 0 };
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.quantity ?? 0)));
    const recurring = Boolean(line.product?.is_recurring);
    if (line.priced.sale_type === 'rental') {
      totals.totalDevices += qty;
      totals.totalAmount += line.priced.total_price;
      totals.rentalAmount += line.priced.total_price;
      totals.monthlyAmount += line.priced.monthly_total;
      continue;
    }
    if (recurring) totals.monthlyAmount += line.priced.total_price;
    else { totals.totalDevices += qty; totals.hardwareAmount += line.priced.total_price; }
    totals.totalAmount += line.priced.total_price;
  }
  totals.totalAmount = round2(totals.totalAmount);
  totals.monthlyAmount = round2(totals.monthlyAmount);
  totals.hardwareAmount = round2(totals.hardwareAmount);
  totals.rentalAmount = round2(totals.rentalAmount);
  return totals;
}

export function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** "01.10.2026 – 30.09.2027 · 12 ay" */
export function rentalPeriodLabel(start?: string | null, end?: string | null) {
  const months = rentalMonths(start, end);
  const fmt = (v?: string | null) => {
    if (!v) return '—';
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  return `${fmt(start)} – ${fmt(end)}${months ? ` · ${months} ay` : ''}`;
}
