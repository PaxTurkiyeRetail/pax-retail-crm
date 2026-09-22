/**
 * HİZMET FATURALARI — paylaşımlı tipler ve saf yardımcılar (sunucuya bağımlı değil).
 * Veri erişimi `service-invoices.ts` içinde; burası istemci ve vitest için.
 *
 * Furkan'ın talebi (11.09), Çağdaş Bey onayı, Sinan'ın tarifi (14.09): entegrasyon / yazılım
 * kullanımı gibi AYLIK hizmetlerin faturaları cihaz satışından ayrı bir sekmede tutulur.
 * Kayıt = firma + ay + para birimi (TL / USD) + kalemler (hizmet × adet × birim fiyat).
 */

export const SERVICE_CURRENCIES = ['TRY', 'USD'] as const;

/**
 * ENTEGRASYON HEDEFİNDE SAYILAN HİZMET KALEMLERİ (Sinan, 22.09.2026: "Cem Koç entegrasyon hedefi doğru
 * gelmiyor; orası KasaPOS ve KasaPOS + TMS sayılmalı, diğerini hedefe dahil etmeyelim").
 *
 * Canlı Ekran'daki Entegrasyon Hedefi kartı (cihaz adedi) yalnız bu anahtarlardaki kalemlerin `quantity`sini
 * sayar; Max Store Kullanım ve AirViewer Kullanım gibi kalemler kullanım lisansıdır, entegre cihaz değil —
 * 17–21.09 arasında hepsi sayılıyordu, Cem Koç'ta bu yüzden şişiyordu. Anahtarlar `system_parameters`
 * `service_invoice_item` grubunun `param_key` değerleri (migration 032). Liste Yönetimleri'nden yeni bir
 * ENTEGRASYON kalemi eklenirse buraya da yazılır; yazılmazsa sayılmaz (sessizce şişmesin diye bilinçli).
 * Para tarafı ("Kazanılan $") bu listeyle SÜZÜLMEZ — o "entegrasyondan gelen fatura tutarı", tüm kalemler.
 */
export const INTEGRATION_DEVICE_SERVICE_KEYS: readonly string[] = ['kasapos_entegrasyonu', 'kasapos_entegrasyonu_tms'];

export function isIntegrationDeviceService(serviceKey: unknown): boolean {
  return typeof serviceKey === 'string' && INTEGRATION_DEVICE_SERVICE_KEYS.includes(serviceKey.trim());
}
export type ServiceCurrency = (typeof SERVICE_CURRENCIES)[number];

export const SERVICE_CURRENCY_LABEL: Record<ServiceCurrency, { code: string; symbol: string }> = {
  TRY: { code: 'TL', symbol: '₺' },
  USD: { code: 'USD', symbol: '$' },
};

export function isServiceCurrency(value: unknown): value is ServiceCurrency {
  return typeof value === 'string' && (SERVICE_CURRENCIES as readonly string[]).includes(value);
}

export type ServiceInvoiceItemRow = {
  id: string;
  line_no: number;
  service_key: string;
  service_label: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type ServiceInvoiceRow = {
  id: string;
  customer_id: string;
  musteri: string;
  owner_name: string;
  owner_user_id: string | null;
  /** Ayın ilk günü (YYYY-MM-01). */
  period_month: string;
  invoice_date: string | null;
  invoice_no: string | null;
  currency: ServiceCurrency;
  amount: number;
  status: 'active' | 'cancelled';
  note: string | null;
  cancel_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  items: ServiceInvoiceItemRow[];
};

export type ServiceInvoiceLineInput = {
  service_key: string;
  quantity: number;
  unit_price: number;
};

export type ServiceInvoiceInput = {
  customerId: string;
  /** 'YYYY-MM' ya da 'YYYY-MM-DD' — ayın 1'ine indirilir. */
  periodMonth: string;
  currency: ServiceCurrency;
  invoiceDate?: string | null;
  invoiceNo?: string | null;
  ownerName?: string | null;
  note?: string | null;
  lines: ServiceInvoiceLineInput[];
};

/** Para birimine göre özet: adet + tutar. */
export type CurrencyTotals = Record<ServiceCurrency, { count: number; amount: number }>;

export function emptyCurrencyTotals(): CurrencyTotals {
  return { TRY: { count: 0, amount: 0 }, USD: { count: 0, amount: 0 } };
}

export type MissingFirm = { customer_id: string; musteri: string; owner_name: string; last_period: string; last_amount: number; currency: ServiceCurrency };

export type ServiceInvoiceSummary = {
  year: number;
  period: string;
  ytd: CurrencyTotals;
  period_totals: CurrencyTotals;
  /** Geçen ay faturası olan ama seçili ayda faturası olmayan firmalar ("her ay kesilmesi zorunlu"). */
  missing: MissingFirm[];
};

/* --- Dönem (ay) yardımcıları ------------------------------------------------ */

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/**
 * 'YYYY-MM' ya da 'YYYY-MM-DD' → 'YYYY-MM-01'. Geçersizse null. Yıl 2020–2100 aralığında olmalı.
 * Geçmiş ay serbesttir (Sinan: "geçmişe dairler de girilebilir olsun"); gelecek ay da engellenmez
 * (peşin fatura olabilir) — ekran uyarır, sunucu reddetmez.
 */
export function normalizePeriodMonth(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

/** 'YYYY-MM-01' → 'Eyl 2026'. */
export function periodLabel(period: string): string {
  const normalized = normalizePeriodMonth(period);
  if (!normalized) return '—';
  return `${MONTHS_TR[Number(normalized.slice(5, 7)) - 1]} ${normalized.slice(0, 4)}`;
}

/** 'YYYY-MM-01' → 'YYYY-MM' (input type=month değeri). */
export function periodInputValue(period: string): string {
  return (normalizePeriodMonth(period) ?? '').slice(0, 7);
}

export function previousPeriod(period: string): string {
  const normalized = normalizePeriodMonth(period);
  if (!normalized) return period;
  let year = Number(normalized.slice(0, 4));
  let month = Number(normalized.slice(5, 7)) - 1;
  if (month === 0) { month = 12; year -= 1; }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Gün anahtarından (YYYY-MM-DD) içinde bulunulan dönem. */
export function currentPeriod(todayKey: string): string {
  return `${todayKey.slice(0, 7)}-01`;
}

/* --- Kalem hesapları --------------------------------------------------------- */

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Satır toplamı = adet × birim fiyat; fatura tutarı = satır toplamları. Geçersiz satırlar
 * (adet ≤ 0, boş hizmet) düşer — sunucu ayrıca doğrular.
 */
export function computeLineTotals(lines: ServiceInvoiceLineInput[]): { lines: Array<ServiceInvoiceLineInput & { total_price: number }>; amount: number } {
  const clean = lines
    .map((line) => ({
      service_key: String(line.service_key ?? '').trim(),
      quantity: Math.floor(Number(line.quantity ?? 0)),
      unit_price: round2(Number(line.unit_price ?? 0)),
    }))
    .filter((line) => line.service_key && Number.isFinite(line.quantity) && line.quantity > 0 && Number.isFinite(line.unit_price) && line.unit_price >= 0)
    .map((line) => ({ ...line, total_price: round2(line.quantity * line.unit_price) }));
  const amount = round2(clean.reduce((sum, line) => sum + line.total_price, 0));
  return { lines: clean, amount };
}

/**
 * "Her ay kesilmesi zorunlu": geçen ay aktif faturası olan firmalardan bu ay faturası olmayanlar.
 * Firma kimliği customer_id; sonuç geçen aydaki tutara göre azalan.
 */
export function missingFirms(
  previous: Array<{ customer_id: string; musteri: string; owner_name: string; period_month: string; amount: number; currency: ServiceCurrency }>,
  current: Array<{ customer_id: string }>,
): MissingFirm[] {
  const covered = new Set(current.map((row) => row.customer_id));
  const seen = new Map<string, MissingFirm>();
  for (const row of previous) {
    if (covered.has(row.customer_id)) continue;
    const cur = seen.get(row.customer_id);
    if (cur) { cur.last_amount = round2(cur.last_amount + Number(row.amount ?? 0)); continue; }
    seen.set(row.customer_id, {
      customer_id: row.customer_id, musteri: row.musteri, owner_name: row.owner_name,
      last_period: row.period_month, last_amount: round2(Number(row.amount ?? 0)), currency: row.currency,
    });
  }
  return Array.from(seen.values()).sort((a, b) => b.last_amount - a.last_amount || a.musteri.localeCompare(b.musteri, 'tr'));
}

/** Para birimine göre biçim: ₺12.500 · $1.200. Kuruş yalnız 0 değilse. */
export function fmtServiceMoney(amount: number, currency: ServiceCurrency): string {
  const value = Number(amount ?? 0);
  const hasCents = Math.round(value * 100) % 100 !== 0;
  const text = value.toLocaleString('tr-TR', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
  return `${SERVICE_CURRENCY_LABEL[currency].symbol}${text}`;
}

/** Toplamları para birimine göre topla (iptal edilenler dışarıda kalır — çağıran filtreler). */
export function sumByCurrency(rows: Array<{ currency: ServiceCurrency; amount: number }>): CurrencyTotals {
  const totals = emptyCurrencyTotals();
  for (const row of rows) {
    if (!isServiceCurrency(row.currency)) continue;
    totals[row.currency].count += 1;
    totals[row.currency].amount = round2(totals[row.currency].amount + Number(row.amount ?? 0));
  }
  return totals;
}
