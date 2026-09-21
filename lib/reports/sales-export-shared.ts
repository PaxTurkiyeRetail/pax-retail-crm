import type { Cell, Sheet } from '@/lib/xlsx/simple-workbook';

/**
 * SATIŞ RAPORLARI (Excel) — saf yardımcılar. Sinan, 21.09.2026:
 *   "Cihaz satış raporu ve hizmet fatura raporu olacak: firma adı, cihazın ne kadara satıldığı, hangi
 *    tarihte satıldığı; Ocak ayı gibi ya da 2026 yılı gibi seçilebilir olsun; satış tiplerini de göstersin
 *    (direkt satış vs.); toplam tutar; cihaz modeli; birim fiyat. Satışlar ekranından alınabilir olmalı,
 *    kişi de seçilebilir olsun, hepsi de olsun."
 *
 * Bu dosya `server-only` içermez: hem API (dönem çözümleme) hem tarayıcı (sayfa kurgusu) hem vitest
 * buradan okur. Veri erişimi `sales-export.ts`, Excel paketi `lib/xlsx/simple-workbook.ts`.
 *
 * Kurallar:
 *   * Satır = KALEM (cihaz modeli × adet × birim fiyat). Kalemi olmayan eski satış (030 öncesi) atlanmaz;
 *     tek satır olarak girer, model "—", birim fiyat BOŞ (uydurulmaz), toplam satışın tutarı, notunda
 *     "kalem kaydı yok" yazar (altın kural 34: eşleşmeyen kayıt sessizce yutulmaz, ekranda söylenir).
 *   * Hizmet faturasında TL ile USD TOPLANMAZ; toplam satırları para birimine göre ayrıdır (032 kararı).
 *   * Yalnız AKTİF kayıtlar; iptal edilenler ciroya girmediği gibi rapora da girmez.
 */

export type ExportKind = 'cihaz' | 'hizmet';

export const MONTH_NAMES_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'] as const;

/** Dönem anahtarı: 'YYYY' (yıl) ya da 'YYYY-MM' (ay). */
export type ExportPeriod = { key: string; label: string; from: string; to: string; kind: 'year' | 'month' };

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 'YYYY' → yılın tamamı, 'YYYY-MM' → o ay; başka biçim → null (uydurma dönem yok). */
export function parsePeriodKey(key: unknown): ExportPeriod | null {
  const text = String(key ?? '').trim();
  const yearMatch = /^(\d{4})$/.exec(text);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (year < 2000 || year > 2100) return null;
    return { key: text, label: `${year} yılı`, from: `${year}-01-01`, to: `${year}-12-31`, kind: 'year' };
  }
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(text);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return {
      key: text,
      label: `${MONTH_NAMES_TR[month - 1]} ${year}`,
      from: `${year}-${pad2(month)}-01`,
      to: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
      kind: 'month',
    };
  }
  return null;
}

/**
 * Seçicideki dönemler: içinde bulunulan yıl + ayları (bu aya kadar, en yeni önce), ardından önceki yıl +
 * 12 ayı. Gelecek ay sunulmaz (veri olamaz). `todayKey` = 'YYYY-MM-DD'.
 */
export function periodOptions(todayKey: string): ExportPeriod[] {
  const year = Number(todayKey.slice(0, 4));
  const month = Math.min(12, Math.max(1, Number(todayKey.slice(5, 7)) || 1));
  const keys: string[] = [String(year)];
  for (let m = month; m >= 1; m -= 1) keys.push(`${year}-${pad2(m)}`);
  keys.push(String(year - 1));
  for (let m = 12; m >= 1; m -= 1) keys.push(`${year - 1}-${pad2(m)}`);
  return keys.map((key) => parsePeriodKey(key)).filter((item): item is ExportPeriod => item != null);
}

/** Varsayılan seçim: içinde bulunulan ay. */
export function defaultPeriodKey(todayKey: string) {
  return todayKey.slice(0, 7);
}

/* --- Cihaz satışı kalemleri ------------------------------------------------- */

export type DeviceSaleLine = {
  sale_id: string;
  /** YYYY-MM-DD */
  sale_date: string;
  musteri: string;
  owner_name: string;
  /** quote = kazanılan teklifden · direct = teklifsiz (027). */
  source: 'quote' | 'direct';
  quote_no: string | null;
  /** Satış kanalı etiketi (Banka · Direkt Satış · Kanal…) — parametre listesinden çözülmüş. */
  sales_channel: string | null;
  note: string | null;
  /** Kalem kaydı yoksa (030 öncesi satış) null; başlık değerleri kullanılır. */
  line_no: number | null;
  product_code: string | null;
  product_name: string | null;
  sale_type: 'sale' | 'rental' | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  rental_monthly_price: number | null;
  rental_start_date: string | null;
  rental_end_date: string | null;
  /** Başlık: kalem yoksa bunlar satıra iner. */
  sale_device_count: number;
  sale_amount: number;
};

export const SOURCE_LABELS: Record<DeviceSaleLine['source'], string> = {
  quote: 'Teklifli satış',
  direct: 'Direkt satış',
};

export const SALE_TYPE_LABELS: Record<'sale' | 'rental', string> = {
  sale: 'Satış',
  rental: 'Kiralama',
};

export type ExportMeta = {
  period: ExportPeriod;
  /** '' = tüm satışçılar. */
  owner: string;
  generatedAt: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function metaRows(meta: ExportMeta, kindLabel: string, lineCount: number): Cell[][] {
  return [
    ['Alan', 'Değer'],
    ['Rapor', kindLabel],
    ['Dönem', meta.period.label],
    ['Satışçı', meta.owner || 'Tüm satışçılar'],
    ['Kayıt (satır)', lineCount],
    ['Üretildi', meta.generatedAt],
    ['Kapsam', 'Yalnız aktif kayıtlar; iptal edilenler dahil değil'],
  ];
}

const DEVICE_HEADERS: Cell[] = [
  'Tarih', 'Firma', 'Satışçı', 'Satış Tipi', 'Kanal', 'Kalem', 'Model', 'Ürün', 'Adet',
  'Birim Fiyat (USD)', 'Toplam (USD)', 'Aylık Kira (USD)', 'Kira Başlangıç', 'Kira Bitiş', 'Teklif No', 'Not',
];
const DEVICE_WIDTHS = [12, 34, 20, 16, 16, 12, 14, 30, 8, 16, 16, 16, 14, 14, 18, 40];

/** Kalem satırı → Excel satırı. Kalemsiz satışta birim fiyat boş bırakılır, not düşülür. */
export function deviceLineToRow(line: DeviceSaleLine): Cell[] {
  const hasItem = line.line_no != null;
  const quantity = hasItem ? num(line.quantity) : num(line.sale_device_count);
  const total = hasItem ? num(line.total_price) : num(line.sale_amount);
  const note = [line.note, hasItem ? null : 'Kalem kaydı yok (030 öncesi satış) — birim fiyat hesaplanmadı'].filter(Boolean).join(' · ');
  return [
    line.sale_date,
    line.musteri,
    line.owner_name,
    SOURCE_LABELS[line.source] ?? line.source,
    line.sales_channel ?? '',
    hasItem && line.sale_type ? SALE_TYPE_LABELS[line.sale_type] : '',
    hasItem ? (line.product_code ?? '—') : '—',
    hasItem ? (line.product_name ?? '') : '',
    quantity,
    hasItem && line.unit_price != null ? round2(num(line.unit_price)) : '',
    round2(total),
    hasItem && line.rental_monthly_price != null ? round2(num(line.rental_monthly_price)) : '',
    line.rental_start_date ?? '',
    line.rental_end_date ?? '',
    line.quote_no ?? '',
    note,
  ];
}

export type DeviceTotals = {
  lines: number;
  sales: number;
  devices: number;
  amount: number;
  byOwner: Array<{ owner: string; sales: number; devices: number; amount: number }>;
  byModel: Array<{ model: string; devices: number; amount: number }>;
  bySource: Array<{ source: string; sales: number; devices: number; amount: number }>;
  /** Kalem kaydı olmayan satış sayısı — raporda ayrıca söylenir. */
  withoutItems: number;
};

export function deviceTotals(lines: DeviceSaleLine[]): DeviceTotals {
  const saleIds = new Set<string>();
  const salesByOwner = new Map<string, Set<string>>();
  const salesBySource = new Map<string, Set<string>>();
  const byOwner = new Map<string, { devices: number; amount: number }>();
  const byModel = new Map<string, { devices: number; amount: number }>();
  const bySource = new Map<string, { devices: number; amount: number }>();
  const withoutItems = new Set<string>();
  let devices = 0;
  let amount = 0;
  for (const line of lines) {
    const hasItem = line.line_no != null;
    const qty = hasItem ? num(line.quantity) : num(line.sale_device_count);
    const total = hasItem ? num(line.total_price) : num(line.sale_amount);
    if (!hasItem) withoutItems.add(line.sale_id);
    saleIds.add(line.sale_id);
    devices += qty;
    amount += total;
    const owner = line.owner_name || '—';
    const ownerAgg = byOwner.get(owner) ?? { devices: 0, amount: 0 };
    ownerAgg.devices += qty; ownerAgg.amount += total; byOwner.set(owner, ownerAgg);
    (salesByOwner.get(owner) ?? salesByOwner.set(owner, new Set()).get(owner)!).add(line.sale_id);
    const model = hasItem ? (line.product_code ?? '—') : '—';
    const modelAgg = byModel.get(model) ?? { devices: 0, amount: 0 };
    modelAgg.devices += qty; modelAgg.amount += total; byModel.set(model, modelAgg);
    const source = SOURCE_LABELS[line.source] ?? line.source;
    const sourceAgg = bySource.get(source) ?? { devices: 0, amount: 0 };
    sourceAgg.devices += qty; sourceAgg.amount += total; bySource.set(source, sourceAgg);
    (salesBySource.get(source) ?? salesBySource.set(source, new Set()).get(source)!).add(line.sale_id);
  }
  const sortByAmount = <T extends { amount: number }>(rows: T[]) => rows.sort((a, b) => b.amount - a.amount);
  return {
    lines: lines.length,
    sales: saleIds.size,
    devices,
    amount: round2(amount),
    byOwner: sortByAmount(Array.from(byOwner, ([owner, agg]) => ({ owner, sales: salesByOwner.get(owner)?.size ?? 0, devices: agg.devices, amount: round2(agg.amount) }))),
    byModel: sortByAmount(Array.from(byModel, ([model, agg]) => ({ model, devices: agg.devices, amount: round2(agg.amount) }))),
    bySource: sortByAmount(Array.from(bySource, ([source, agg]) => ({ source, sales: salesBySource.get(source)?.size ?? 0, devices: agg.devices, amount: round2(agg.amount) }))),
    withoutItems: withoutItems.size,
  };
}

/** Cihaz Satış Raporu sayfaları: Kalemler (+ toplam satırı) · Özet. */
export function deviceSheets(lines: DeviceSaleLine[], meta: ExportMeta): Sheet[] {
  const totals = deviceTotals(lines);
  const rows: Cell[][] = [DEVICE_HEADERS, ...lines.map(deviceLineToRow)];
  if (lines.length) {
    rows.push(['TOPLAM', `${totals.sales} satış`, '', '', '', '', '', '', totals.devices, '', totals.amount, '', '', '', '', totals.withoutItems ? `${totals.withoutItems} satışta kalem kaydı yok` : '']);
  } else {
    rows.push(['Bu dönemde kayıt yok', '', '', '', '', '', '', '', 0, '', 0, '', '', '', '', '']);
  }
  const summary: Cell[][] = [
    ...metaRows(meta, 'Cihaz Satış Raporu', lines.length),
    ['Satış sayısı', totals.sales],
    ['Cihaz adedi', totals.devices],
    ['Toplam (USD)', totals.amount],
    ['Kalem kaydı olmayan satış', totals.withoutItems],
    [],
    ['Satış Tipi', 'Satış', 'Adet', 'Toplam (USD)'],
    ...totals.bySource.map((row) => [row.source, row.sales, row.devices, row.amount] as Cell[]),
    [],
    ['Satışçı', 'Satış', 'Adet', 'Toplam (USD)'],
    ...totals.byOwner.map((row) => [row.owner, row.sales, row.devices, row.amount] as Cell[]),
    [],
    ['Model', 'Adet', 'Toplam (USD)'],
    ...totals.byModel.map((row) => [row.model, row.devices, row.amount] as Cell[]),
  ];
  return [
    { name: 'Kalemler', rows, widths: DEVICE_WIDTHS },
    { name: 'Özet', rows: summary, widths: [28, 18, 14, 16] },
  ];
}

/* --- Hizmet faturası kalemleri --------------------------------------------- */

export type ServiceInvoiceLine = {
  invoice_id: string;
  /** YYYY-MM-01 */
  period_month: string;
  invoice_date: string | null;
  invoice_no: string | null;
  musteri: string;
  owner_name: string;
  currency: 'TRY' | 'USD';
  note: string | null;
  line_no: number | null;
  service_label: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  /** Başlık tutarı — kalemsiz (beklenmez ama) faturada satıra iner. */
  invoice_amount: number;
};

const SERVICE_HEADERS: Cell[] = ['Dönem', 'Fatura Tarihi', 'Fatura No', 'Firma', 'Satışçı', 'Hizmet', 'Adet', 'Birim Fiyat', 'Toplam', 'Para Birimi', 'Not'];
const SERVICE_WIDTHS = [12, 14, 20, 34, 20, 30, 8, 14, 16, 12, 40];

/** 'YYYY-MM-01' → 'Eylül 2026'. */
export function periodMonthLabel(periodMonth: string) {
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(5, 7));
  if (!year || !month || month < 1 || month > 12) return periodMonth;
  return `${MONTH_NAMES_TR[month - 1]} ${year}`;
}

export function serviceLineToRow(line: ServiceInvoiceLine): Cell[] {
  const hasItem = line.line_no != null;
  return [
    periodMonthLabel(line.period_month),
    line.invoice_date ?? '',
    line.invoice_no ?? '',
    line.musteri,
    line.owner_name,
    hasItem ? (line.service_label ?? '') : '—',
    hasItem ? num(line.quantity) : '',
    hasItem && line.unit_price != null ? round2(num(line.unit_price)) : '',
    round2(hasItem ? num(line.total_price) : num(line.invoice_amount)),
    line.currency,
    [line.note, hasItem ? null : 'Kalem kaydı yok'].filter(Boolean).join(' · '),
  ];
}

export type ServiceTotals = {
  lines: number;
  invoices: number;
  /** Para birimine göre AYRI — TL ile USD toplanmaz. */
  byCurrency: Array<{ currency: 'TRY' | 'USD'; invoices: number; quantity: number; amount: number }>;
  byOwner: Array<{ owner: string; currency: 'TRY' | 'USD'; invoices: number; quantity: number; amount: number }>;
  byService: Array<{ service: string; currency: 'TRY' | 'USD'; quantity: number; amount: number }>;
};

export function serviceTotals(lines: ServiceInvoiceLine[]): ServiceTotals {
  const invoiceIds = new Set<string>();
  const byCurrency = new Map<string, { invoices: Set<string>; quantity: number; amount: number }>();
  const byOwner = new Map<string, { owner: string; currency: 'TRY' | 'USD'; invoices: Set<string>; quantity: number; amount: number }>();
  const byService = new Map<string, { service: string; currency: 'TRY' | 'USD'; quantity: number; amount: number }>();
  for (const line of lines) {
    const hasItem = line.line_no != null;
    const qty = hasItem ? num(line.quantity) : 0;
    const total = hasItem ? num(line.total_price) : num(line.invoice_amount);
    invoiceIds.add(line.invoice_id);
    const cur = byCurrency.get(line.currency) ?? { invoices: new Set<string>(), quantity: 0, amount: 0 };
    cur.invoices.add(line.invoice_id); cur.quantity += qty; cur.amount += total; byCurrency.set(line.currency, cur);
    const ownerKey = `${line.owner_name || '—'}|${line.currency}`;
    const own = byOwner.get(ownerKey) ?? { owner: line.owner_name || '—', currency: line.currency, invoices: new Set<string>(), quantity: 0, amount: 0 };
    own.invoices.add(line.invoice_id); own.quantity += qty; own.amount += total; byOwner.set(ownerKey, own);
    const serviceKey = `${hasItem ? (line.service_label ?? '—') : '—'}|${line.currency}`;
    const svc = byService.get(serviceKey) ?? { service: hasItem ? (line.service_label ?? '—') : '—', currency: line.currency, quantity: 0, amount: 0 };
    svc.quantity += qty; svc.amount += total; byService.set(serviceKey, svc);
  }
  const order = (currency: string) => (currency === 'USD' ? 0 : 1);
  return {
    lines: lines.length,
    invoices: invoiceIds.size,
    byCurrency: Array.from(byCurrency, ([currency, agg]) => ({ currency: currency as 'TRY' | 'USD', invoices: agg.invoices.size, quantity: agg.quantity, amount: round2(agg.amount) }))
      .sort((a, b) => order(a.currency) - order(b.currency)),
    byOwner: Array.from(byOwner.values(), (agg) => ({ owner: agg.owner, currency: agg.currency, invoices: agg.invoices.size, quantity: agg.quantity, amount: round2(agg.amount) }))
      .sort((a, b) => order(a.currency) - order(b.currency) || b.amount - a.amount),
    byService: Array.from(byService.values(), (agg) => ({ ...agg, amount: round2(agg.amount) }))
      .sort((a, b) => order(a.currency) - order(b.currency) || b.amount - a.amount),
  };
}

/** Hizmet Fatura Raporu sayfaları: Kalemler (+ para birimi başına toplam) · Özet. */
export function serviceSheets(lines: ServiceInvoiceLine[], meta: ExportMeta): Sheet[] {
  const totals = serviceTotals(lines);
  const rows: Cell[][] = [SERVICE_HEADERS, ...lines.map(serviceLineToRow)];
  if (lines.length) {
    for (const row of totals.byCurrency) {
      rows.push([`TOPLAM ${row.currency}`, `${row.invoices} fatura`, '', '', '', '', row.quantity, '', row.amount, row.currency, 'Para birimleri ayrı toplanır']);
    }
  } else {
    rows.push(['Bu dönemde kayıt yok', '', '', '', '', '', '', '', 0, '', '']);
  }
  const summary: Cell[][] = [
    ...metaRows(meta, 'Hizmet Fatura Raporu', lines.length),
    ['Fatura sayısı', totals.invoices],
    ...totals.byCurrency.map((row) => [`Toplam (${row.currency})`, row.amount] as Cell[]),
    [],
    ['Satışçı', 'Para Birimi', 'Fatura', 'Adet', 'Toplam'],
    ...totals.byOwner.map((row) => [row.owner, row.currency, row.invoices, row.quantity, row.amount] as Cell[]),
    [],
    ['Hizmet', 'Para Birimi', 'Adet', 'Toplam'],
    ...totals.byService.map((row) => [row.service, row.currency, row.quantity, row.amount] as Cell[]),
  ];
  return [
    { name: 'Kalemler', rows, widths: SERVICE_WIDTHS },
    { name: 'Özet', rows: summary, widths: [28, 14, 12, 12, 16] },
  ];
}

/* --- Ortak ----------------------------------------------------------------- */

export const KIND_LABELS: Record<ExportKind, string> = {
  cihaz: 'Cihaz Satış Raporu',
  hizmet: 'Hizmet Fatura Raporu',
};

function slug(value: string) {
  return value
    .replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** 'cihaz-satis-raporu_2026-09_Cem-Koc.xlsx' — dosya adı boşluksuz ve ASCII. */
export function exportFileName(kind: ExportKind, periodKey: string, owner: string) {
  const ownerPart = owner ? `_${slug(owner)}` : '_tum-saticilar';
  return `${slug(KIND_LABELS[kind])}_${periodKey}${ownerPart}.xlsx`;
}

/** Seçicideki satışçılar: satış ekibi (Canlı Ekran sırası) + veride görülen ama listede olmayan adlar. */
export function ownerChoices(team: readonly string[], seen: readonly string[]) {
  const out = [...team];
  for (const name of seen) {
    const clean = String(name ?? '').trim();
    if (clean && !out.some((known) => known.toLocaleLowerCase('tr') === clean.toLocaleLowerCase('tr'))) out.push(clean);
  }
  return out;
}
