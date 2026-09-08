import 'server-only';
import type { PgClient } from '@/lib/pg/client';
import { STATIC_QUOTE_PRICING_RULES, STATIC_QUOTE_PRODUCTS, normalizeQuoteProduct, type QuotePricingRule, type QuoteProduct } from '@/lib/quotes/catalog';
import { normalizeSaleType, priceLine, sumLineTotals, type SaleType } from '@/lib/quotes/line-pricing';

export type QuoteLineInput = {
  product_id: string;
  quantity: number;
  /** 'sale' (varsayılan) | 'rental' — kiralama satırı tarihli ve aylık kira bedelli. */
  sale_type?: SaleType | null;
  rental_start_date?: string | null;
  rental_end_date?: string | null;
  rental_monthly_price?: number | null;
};

export type ResolvedQuoteLine = {
  product_id: string;
  product_code: string;
  product_name: string;
  product_type: QuoteProduct['product_type'];
  category: QuoteProduct['category'];
  is_recurring: boolean;
  billing_period: QuoteProduct['billing_period'];
  quantity: number;
  /** Satışta kademe birim fiyatı, kiralamada aylık birim kira. */
  unit_price: number;
  total_price: number;
  /** Kiralama satırında null (kademe yok). */
  pricing_rule: { min_qty: number; max_qty: number | null } | null;
  sale_type: SaleType;
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_monthly_price: number | null;
  rental_months: number;
};

export function isMissingRelationError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '');
  return /relation .* does not exist/i.test(message) || /Could not find the table/i.test(message);
}

export function getTurkeyTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function addDaysToIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00+03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeDateOnly(value: unknown, fallback?: string | null) {
  if (value == null) return fallback ?? null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return fallback ?? null;

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return fallback ?? null;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

export async function getQuoteCatalog(admin?: PgClient) {
  if (!admin) return { products: STATIC_QUOTE_PRODUCTS, rules: STATIC_QUOTE_PRICING_RULES, source: 'static' as const };

  const [{ data: products, error: productErr }, { data: rules, error: ruleErr }] = await Promise.all([
    admin.from('quote_products').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    admin.from('quote_pricing_rules').select('*').order('min_qty', { ascending: true }),
  ]);

  if (productErr || ruleErr) {
    if (isMissingRelationError(productErr ?? ruleErr)) {
      return { products: STATIC_QUOTE_PRODUCTS, rules: STATIC_QUOTE_PRICING_RULES, source: 'static' as const };
    }
    throw productErr ?? ruleErr;
  }

  return {
    products: (products ?? []).map((product: any) => normalizeQuoteProduct(product)) as QuoteProduct[],
    rules: (rules ?? []) as QuotePricingRule[],
    source: 'db' as const,
  };
}

export function resolveQuoteLines(items: QuoteLineInput[], catalog: { products: QuoteProduct[]; rules: QuotePricingRule[] }) {
  const productMap = new Map(catalog.products.map((product) => [product.id, product]));
  const rulesByProduct = new Map<string, QuotePricingRule[]>();
  catalog.rules.forEach((rule) => {
    const list = rulesByProduct.get(rule.product_id) ?? [];
    list.push(rule);
    rulesByProduct.set(rule.product_id, list);
  });

  const resolved: ResolvedQuoteLine[] = items
    .map((item) => ({ ...item, quantity: Number(item.quantity ?? 0) }))
    .filter((item) => item.product_id && Number.isFinite(item.quantity) && item.quantity > 0)
    .map((item) => {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Ürün bulunamadı: ${item.product_id}`);
      const saleType = normalizeSaleType(item.sale_type);
      if (saleType === 'rental' && product.is_recurring) throw new Error(`Aylık hizmet kalemi kiralama olarak girilemez: ${product.name}`);
      const rules = rulesByProduct.get(item.product_id) ?? [];
      // İstemciyle aynı hesap (lib/quotes/line-pricing.ts): satış = kademe, kiralama = kira × adet × ay.
      const priced = priceLine({
        product_id: item.product_id,
        quantity: item.quantity,
        sale_type: saleType,
        rental_start_date: normalizeDateOnly(item.rental_start_date, null),
        rental_end_date: normalizeDateOnly(item.rental_end_date, null),
        rental_monthly_price: item.rental_monthly_price == null ? null : Number(item.rental_monthly_price),
      }, rules);
      if (!priced.priced) {
        throw new Error(saleType === 'rental'
          ? `${product.name}: ${priced.problem}`
          : `Fiyat kuralı bulunamadı: ${product.name} (${item.quantity})`);
      }
      return {
        product_id: item.product_id,
        product_code: product.code,
        product_name: product.name,
        product_type: product.product_type,
        category: product.category,
        is_recurring: product.is_recurring,
        billing_period: product.billing_period,
        quantity: item.quantity,
        unit_price: priced.unit_price,
        total_price: priced.total_price,
        pricing_rule: priced.rule ? { min_qty: priced.rule.min_qty, max_qty: priced.rule.max_qty } : null,
        sale_type: saleType,
        rental_start_date: saleType === 'rental' ? normalizeDateOnly(item.rental_start_date, null) : null,
        rental_end_date: saleType === 'rental' ? normalizeDateOnly(item.rental_end_date, null) : null,
        rental_monthly_price: saleType === 'rental' ? priced.unit_price : null,
        rental_months: priced.rental_months,
      } satisfies ResolvedQuoteLine;
    });

  const totals = sumLineTotals(resolved.map((row) => ({
    quantity: row.quantity,
    product: { id: row.product_id, product_type: row.product_type, is_recurring: row.is_recurring },
    priced: priceLine({
      product_id: row.product_id, quantity: row.quantity, sale_type: row.sale_type,
      rental_start_date: row.rental_start_date, rental_end_date: row.rental_end_date, rental_monthly_price: row.rental_monthly_price,
    }, rulesByProduct.get(row.product_id) ?? []),
  })));

  return {
    items: resolved,
    totalAmount: totals.totalAmount,
    totalDeviceCount: totals.totalDevices,
    monthlyAmount: totals.monthlyAmount,
    hardwareAmount: totals.hardwareAmount,
    rentalAmount: totals.rentalAmount,
  };
}

export function buildQuoteSummaryText(items: Array<{ product_name: string; quantity: number }>) {
  return items.slice(0, 3).map((item) => `${item.quantity} ${item.product_name}`).join(', ');
}


export function buildQuoteActivityNote(args: {
  quoteNo: string;
  summaryText: string;
  validUntil?: string | null;
}) {
  const quoteNo = String(args.quoteNo ?? '').trim() || '-';
  const summaryText = String(args.summaryText ?? '').trim() || '-';
  const validUntil = normalizeDateOnly(args.validUntil, null);
  return `Quote ${quoteNo} paylaşıldı. İçerik: ${summaryText} | Geçerlilik: ${validUntil ?? '-'}`;
}

export async function ensureCustomerExistsOrThrow(args: {
  admin: PgClient;
  customerId: string;
}) {
  const { admin, customerId } = args;
  const { data: customer, error } = await admin
    .from('musteriler')
    .select('id,musteri,sorumlu,sektor,entegrasyon_tipi')
    .eq('id', customerId)
    .maybeSingle();

  if (error) throw error;
  if (!customer) throw Object.assign(new Error('Müşteri bulunamadı'), { status: 404 });
  return customer;
}

export async function getNextQuoteNumber(admin: PgClient) {
  const year = Number(getTurkeyTodayIso().slice(0, 4));
  const { data, error } = await admin
    .from('quotes')
    .select('quote_serial')
    .eq('quote_year', year)
    .order('quote_serial', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const serial = Number((data as any)?.quote_serial ?? 0) + 1;
  return {
    quote_year: year,
    quote_serial: serial,
    quote_no: `Q-${year}-${String(serial).padStart(3, '0')}`,
  };
}

export async function createQuoteActivity(args: {
  admin: PgClient;
  customerId: string;
  quoteId: string;
  quoteNo: string;
  ownerName: string;
  ownerUserId?: string | null;
  ownerEmail?: string | null;
  followUpDate: string;
  validUntil: string;
  summaryText: string;
}) {
  const { admin, customerId, quoteId, quoteNo, ownerName, ownerUserId, ownerEmail, followUpDate, validUntil, summaryText } = args;
  const proposalDate = getTurkeyTodayIso();
  const normalizedFollowUpDate = normalizeDateOnly(followUpDate, addDaysToIsoDate(proposalDate, 30));
  const normalizedValidUntil = normalizeDateOnly(validUntil, addDaysToIsoDate(proposalDate, 15));
  const normalizedTargetDate = normalizedValidUntil ?? normalizedFollowUpDate;
  const [{ data: pipeline }, { data: latestPhaseEvent }] = await Promise.all([
    admin.from('musteri_pipeline').select('aktif_faz_no,owner,partner_owner').eq('musteri_id', customerId).maybeSingle(),
    admin.from('pipeline_eventleri').select('faz_no,iteration_no').eq('musteri_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const fazNo = Number((pipeline as any)?.aktif_faz_no ?? (latestPhaseEvent as any)?.faz_no ?? 10) || 10;
  const iterationNo = Number((latestPhaseEvent as any)?.iteration_no ?? 1) || 1;
  const note = `Quote ${quoteNo} paylaşıldı. İçerik: ${summaryText || '-'} | Geçerlilik: ${normalizedValidUntil}`;

  const { data, error } = await admin.from('pipeline_eventleri').insert({
    musteri_id: customerId,
    faz_no: fazNo,
    iteration_no: iterationNo,
    event_type: 'quote_sent',
    durum: 'Başlamadı',
    aksiyon: 'AKTIVITE:Teklif Paylaşıldı',
    owner: String((pipeline as any)?.owner ?? ownerName ?? '').trim() || null,
    partner_owner: String((pipeline as any)?.partner_owner ?? 'Müşteri').trim() || 'Müşteri',
    baslangic_tarihi: null,
    hedef_tarihi: normalizedTargetDate,
    notlar: note,
    created_by: ownerName,
    created_by_user_id: ownerUserId ?? null,
    created_by_email: ownerEmail ?? null,
  }).select('id').single();

  if (error) throw error;

  await admin.from('quotes').update({ activity_event_id: (data as any)?.id ?? null }).eq('id', quoteId);
  return (data as any)?.id as string | null;
}

export async function getQuoteDetailById(admin: PgClient, quoteId: string) {
  const { data: quote, error } = await admin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();
  if (error) throw error;
  if (!quote) return null;

  const [{ data: customer }, { data: items }] = await Promise.all([
    admin.from('musteriler').select('id,musteri,sektor,sorumlu,entegrasyon_tipi').eq('id', (quote as any).customer_id).maybeSingle(),
    admin.from('quote_items').select('*').eq('quote_id', quoteId).order('line_no', { ascending: true }),
  ]);

  return {
    ...(quote as any),
    customer: customer ?? null,
    items: items ?? [],
  };
}
