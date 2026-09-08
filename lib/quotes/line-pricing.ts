// Teklif satırı fiyatlama — istemci (QuoteBuilder / QuoteDetail) ve sunucu
// (resolveQuoteLines) AYNI hesabı kullanır; iki tarafın ayrışması "ekranda başka,
// kayıtta başka tutar" hatasına yol açıyordu.
//
// Satış tipi (08.09 satış ekibi isteği):
//   'sale'   → katalog kademesi (quote_pricing_rules): birim × adet.
//   'rental' → KİRALAMA. Aylık birim kira KATALOGDAN gelir (quote_products.rental_monthly_price,
//              08.09 tarifesi: A80 15 · A910S 15 · A6650 20 USD/ay, KDV hariç); satırda elle
//              ezilebilir. TARİH YOK (Sinan, 08.09: "kiralamada tarihe gerek yok"):
//              satır tutarı = aylık kira × adet ve "/ ay" olarak okunur; aylık recurring toplamına
//              girer (KasaPOS/TMS gibi aylık kalemlerle aynı muamele). Eski kayıtlarda tarih
//              varsa sözleşme değeri = aylık × ay hesaplanmaya devam eder.

export type SaleType = 'sale' | 'rental';

export type LineDraft = {
  product_id: string;
  quantity: number;
  sale_type?: SaleType | null;
  rental_start_date?: string | null;
  rental_end_date?: string | null;
  /** Aylık birim kira (USD). Boşsa ürünün katalog tarifesi (rental_monthly_price) kullanılır. */
  rental_monthly_price?: number | null;
};

export type PricingRuleLike = { product_id: string; min_qty: number; max_qty: number | null; unit_price: number };
export type ProductLike = {
  id: string;
  product_type: string;
  is_recurring: boolean;
  /** Katalog kira tarifesi (USD/ay); null = kiralanamaz / tarife yok. */
  rental_monthly_price?: number | null;
};

export type PricedLine = {
  sale_type: SaleType;
  /** Eşleşen kademe (satış) — kiralamada null. */
  rule: PricingRuleLike | null;
  rule_label: string;
  unit_price: number;
  total_price: number;
  /** Kiralama süresi (ay) — tarih girilmemişse ve satışta 0. */
  rental_months: number;
  /** Kiralama satırının aylık toplamı (birim kira × adet) — satışta 0. */
  monthly_total: number;
  /** Aylık kira katalog tarifesinden mi (true) yoksa satırda elle mi girildi (false). Satışta false. */
  rental_from_catalog: boolean;
  /** Fiyatlanabildi mi (kademe bulundu / kira bedeli var). */
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

/** Satırdaki aylık kira: elle girilmişse o, yoksa katalog tarifesi. */
export function resolveRentalMonthly(draft: Pick<LineDraft, 'rental_monthly_price'>, product?: ProductLike | null) {
  const manual = draft.rental_monthly_price == null ? NaN : Number(draft.rental_monthly_price);
  if (Number.isFinite(manual) && manual > 0) return { monthly: manual, fromCatalog: false };
  const catalog = product?.rental_monthly_price == null ? NaN : Number(product.rental_monthly_price);
  if (Number.isFinite(catalog) && catalog > 0) return { monthly: catalog, fromCatalog: true };
  return { monthly: 0, fromCatalog: false };
}

export function priceLine(draft: LineDraft, rules: PricingRuleLike[], product?: ProductLike | null): PricedLine {
  const quantity = Math.max(0, Math.floor(Number(draft.quantity ?? 0)));
  const saleType = normalizeSaleType(draft.sale_type);
  if (saleType === 'rental') {
    const hasDates = Boolean(draft.rental_start_date && draft.rental_end_date);
    const months = rentalMonths(draft.rental_start_date, draft.rental_end_date);
    const { monthly, fromCatalog } = resolveRentalMonthly(draft, product);
    const monthlyOk = monthly > 0;
    const problem = !monthlyOk
      ? 'Bu ürün için katalogda kira tarifesi yok; aylık birim kira girin.'
      : hasDates && months <= 0
        ? 'Kiralama bitiş tarihi başlangıçtan sonra olmalı.'
        : null;
    const monthlyTotal = monthlyOk ? monthly * quantity : 0;
    // Tarih yok → aylık tutar ("/ ay"); tarih var (eski kayıt) → sözleşme değeri = aylık × ay.
    const total = problem ? 0 : hasDates ? monthlyTotal * months : monthlyTotal;
    return {
      sale_type: 'rental',
      rule: null,
      rule_label: hasDates && months > 0 ? `${months} ay kiralama` : fromCatalog ? 'kiralama · katalog tarifesi' : 'kiralama · anlaşma kirası',
      unit_price: monthlyOk ? monthly : 0,
      total_price: round2(total),
      rental_months: hasDates ? months : 0,
      monthly_total: round2(monthlyTotal),
      rental_from_catalog: fromCatalog,
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
    rental_from_catalog: false,
    priced: Boolean(rule),
    problem: rule ? null : 'Bu adet için fiyat kademesi bulunamadı.',
  };
}

export type LineTotals = { totalDevices: number; totalAmount: number; monthlyAmount: number; hardwareAmount: number; rentalAmount: number };

/**
 * Teklif toplamları.
 *  - totalDevices: tekrarlayan hizmet dışındaki satırların adedi (kiralanan cihaz da cihazdır).
 *  - totalAmount: satış satırları + kiralama satırlarının tutarı (tarihsiz kiralamada aylık tutar —
 *    aylık hizmet kalemleriyle aynı muamele; tarihli eski kayıtta sözleşme değeri).
 *  - monthlyAmount: aylık hizmetler + aylık kira toplamı.
 *  - hardwareAmount: tek seferlik satış satırları (donanım).
 *  - rentalAmount: SADECE tarihli kiralamanın sözleşme değeri (tarihsizde 0 — "sözleşme değeri" gösterilmez).
 */
export function sumLineTotals(lines: Array<{ quantity: number; product: ProductLike | null; priced: PricedLine }>): LineTotals {
  const totals: LineTotals = { totalDevices: 0, totalAmount: 0, monthlyAmount: 0, hardwareAmount: 0, rentalAmount: 0 };
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.quantity ?? 0)));
    const recurring = Boolean(line.product?.is_recurring);
    if (line.priced.sale_type === 'rental') {
      totals.totalDevices += qty;
      totals.totalAmount += line.priced.total_price;
      if (line.priced.rental_months > 0) totals.rentalAmount += line.priced.total_price;
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
