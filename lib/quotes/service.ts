import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { STATIC_QUOTE_PRICING_RULES, STATIC_QUOTE_PRODUCTS, type QuotePricingRule, type QuoteProduct } from '@/lib/quotes/catalog';
import { isAdminLike, type AllowedRole } from '@/lib/roles';

export type QuoteLineInput = {
  product_id: string;
  quantity: number;
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
  unit_price: number;
  total_price: number;
  pricing_rule: { min_qty: number; max_qty: number | null };
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

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

export async function getQuoteCatalog(admin?: SupabaseClient<any, any, any>) {
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
    products: (products ?? []) as QuoteProduct[],
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
      const rules = (rulesByProduct.get(item.product_id) ?? []).sort((a, b) => a.min_qty - b.min_qty);
      const match = rules.find((rule) => item.quantity >= rule.min_qty && (rule.max_qty == null || item.quantity <= rule.max_qty));
      if (!match) throw new Error(`Fiyat kuralı bulunamadı: ${product.name} (${item.quantity})`);
      return {
        product_id: item.product_id,
        product_code: product.code,
        product_name: product.name,
        product_type: product.product_type,
        category: product.category,
        is_recurring: product.is_recurring,
        billing_period: product.billing_period,
        quantity: item.quantity,
        unit_price: Number(match.unit_price),
        total_price: Number(match.unit_price) * item.quantity,
        pricing_rule: { min_qty: match.min_qty, max_qty: match.max_qty },
      } satisfies ResolvedQuoteLine;
    });

  const totalAmount = resolved.reduce((sum, row) => sum + row.total_price, 0);
  const totalDeviceCount = resolved.filter((row) => !row.is_recurring).reduce((sum, row) => sum + row.quantity, 0);
  const monthlyAmount = resolved.filter((row) => row.is_recurring).reduce((sum, row) => sum + row.total_price, 0);
  const hardwareAmount = resolved.filter((row) => !row.is_recurring).reduce((sum, row) => sum + row.total_price, 0);

  return { items: resolved, totalAmount, totalDeviceCount, monthlyAmount, hardwareAmount };
}

export function buildQuoteSummaryText(items: Array<{ product_name: string; quantity: number }>) {
  return items.slice(0, 3).map((item) => `${item.quantity} ${item.product_name}`).join(', ');
}

export async function ensureCustomerAccessOrThrow(args: {
  admin: SupabaseClient<any, any, any>;
  customerId: string;
  role: AllowedRole;
  fullName: string | null | undefined;
}) {
  const { admin, customerId, role, fullName } = args;
  const { data: customer, error } = await admin
    .from('musteriler')
    .select('id,musteri,sorumlu,sektor,entegrasyon_tipi')
    .eq('id', customerId)
    .maybeSingle();

  if (error) throw error;
  if (!customer) throw Object.assign(new Error('Müşteri bulunamadı'), { status: 404 });

  if (!isAdminLike(role)) {
    const owner = String(customer.sorumlu ?? '').trim();
    const actor = String(fullName ?? '').trim();
    if (!owner || !actor || owner !== actor) {
      throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
    }
  }

  return customer;
}

export async function getNextQuoteNumber(admin: SupabaseClient<any, any, any>) {
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
  admin: SupabaseClient<any, any, any>;
  customerId: string;
  quoteId: string;
  quoteNo: string;
  ownerName: string;
  followUpDate: string;
  validUntil: string;
  summaryText: string;
}) {
  const { admin, customerId, quoteId, quoteNo, ownerName, followUpDate, validUntil, summaryText } = args;
  const [{ data: pipeline }, { data: latestPhaseEvent }] = await Promise.all([
    admin.from('musteri_pipeline').select('aktif_faz_no,owner,partner_owner').eq('musteri_id', customerId).maybeSingle(),
    admin.from('pipeline_eventleri').select('faz_no,iteration_no').eq('musteri_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const fazNo = Number((pipeline as any)?.aktif_faz_no ?? (latestPhaseEvent as any)?.faz_no ?? 10) || 10;
  const iterationNo = Number((latestPhaseEvent as any)?.iteration_no ?? 1) || 1;
  const note = `Quote ${quoteNo} paylaşıldı. İçerik: ${summaryText || '-'} | Geçerlilik: ${validUntil}`;

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
    hedef_tarihi: followUpDate,
    notlar: note,
    created_by: ownerName,
  }).select('id').single();

  if (error) throw error;

  await admin.from('quotes').update({ activity_event_id: (data as any)?.id ?? null }).eq('id', quoteId);
  return (data as any)?.id as string | null;
}

export async function getQuoteDetailById(admin: SupabaseClient<any, any, any>, quoteId: string) {
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
