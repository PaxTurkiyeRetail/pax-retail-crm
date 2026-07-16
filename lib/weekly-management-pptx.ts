import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import type { WeeklyManagementPresentationPayload, PresentationCustomer, ActivityRow, WeeklyActivityNarrativeItem } from '@/lib/weekly-management-presentation';
import { buildWeeklyManagementPresentation } from '@/lib/weekly-management-presentation';
import { BUSINESS_PARTNER_RESPONSIBLE, normalizeResponsible } from '@/lib/report-only-customers';

function stripInvalidXmlChars(value: string) {
  // PowerPoint 'Onar' hatasının en sık sebebi CRM notlarından gelen XML 1.0 dışı
  // kontrol karakterleridir. Sekme, satır sonu ve carriage return korunur.
  // Emoji/status ikonları (🟡/🔴/🟢 gibi) geçerli surrogate pair olarak gelir;
  // eski regex tüm surrogate karakterleri sildiği için Kasa Pos Entegrasyon
  // Durumları sayfasındaki ikonlar kayboluyordu. Bu yüzden string'i code point
  // bazında gezip sadece XML 1.0 için geçersiz karakterleri temizliyoruz.
  let clean = '';
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (
      code === 0x09
      || code === 0x0a
      || code === 0x0d
      || (code >= 0x20 && code <= 0xd7ff)
      || (code >= 0xe000 && code <= 0xfffd)
      || (code >= 0x10000 && code <= 0x10ffff)
    ) {
      clean += char;
    }
  }
  return clean;
}

function escapeXml(value: string) {
  return stripInvalidXmlChars(String(value ?? ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  return value.toLocaleString('tr-TR');
}

function toDateInput(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDots(value: string) {
  const [year, month, day] = String(value || '').split('-');
  if (!year || !month || !day) return value || '';
  return `${day}.${month}.${year}`;
}

function formatDateRangeDots(from: string, to: string) {
  return `${formatDateDots(from)} - ${formatDateDots(to)}`;
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function trimText(value: unknown, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function truncate(value: string, limit: number) {
  const clean = trimText(value);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function joinNarrative(lines: string[], maxChars: number, separator = '  ') {
  const selected: string[] = [];
  let size = 0;
  for (const line of lines.map((item) => trimText(item)).filter(Boolean)) {
    const next = size + line.length + separator.length;
    if (selected.length > 0 && next > maxChars) break;
    selected.push(line);
    size = next;
  }
  return selected.join(separator);
}

function joinBulletLines(lines: string[], maxItems?: number) {
  const selected = (typeof maxItems === 'number' ? lines.slice(0, maxItems) : lines)
    .map((item) => trimText(item))
    .filter(Boolean);
  return selected.join('\n');
}

function paginateLines(lines: string[], maxChars: number, pageCount: number) {
  const pages = Array.from({ length: pageCount }, () => '');
  let cursor = 0;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const bucket: string[] = [];
    let size = 0;
    while (cursor < lines.length) {
      const item = trimText(lines[cursor]);
      if (!item) {
        cursor += 1;
        continue;
      }
      const next = size + item.length + 3;
      if (bucket.length > 0 && next > maxChars) break;
      bucket.push(item);
      size = next;
      cursor += 1;
    }
    pages[pageIndex] = bucket.join('  ');
  }
  return pages;
}

function paginateByCount<T>(items: T[], pageSize: number, pageCount: number) {
  return Array.from({ length: pageCount }, (_, index) => items.slice(index * pageSize, (index + 1) * pageSize));
}

function summarizeCounts(labels: string[]) {
  const map = new Map<string, number>();
  for (const label of labels.map((item) => trimText(item, 'Diğer'))) {
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

function normalizeText(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

function pickDistributionLabel(...values: unknown[]) {
  for (const value of values) {
    const text = trimText(value, '');
    if (!text || text === '-' || /^yok$/i.test(text) || /^belirsiz$/i.test(text)) continue;
    return text;
  }
  return '';
}

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function isDistributionChannelSector(value: unknown) {
  const text = normalizeText(value);
  if (!text) return false;
  return text.includes('fmsc dağıtım kanalları')
    || text.includes('fmsc dagitim kanallari')
    || text.includes('fmcg dağıtım kanalları')
    || text.includes('fmcg dagitim kanallari')
    || text.includes('lojistik & kargo')
    || text.includes('lojistik ve kargo')
    || text.includes('lojistik kargo');
}

function isOtherKasaposFirm(value: unknown) {
  const text = normalizeText(value);
  return text === 'diğer' || text === 'diger' || text === 'other';
}

function isExcludedFromOtherKasaposReportSector(value: unknown) {
  const text = normalizeText(value);
  if (!text) return false;
  return text.includes('fmsc dağıtım kanalları')
    || text.includes('fmsc dagitim kanallari')
    || text.includes('lojistik & kargo')
    || text.includes('lojistik ve kargo')
    || text.includes('lojistik kargo');
}

function isExcludedKasaPos(value: unknown) {
  const text = normalizeText(value);
  return text.includes('nebim') || text.includes('toshiba');
}

function segmentName(item: PresentationCustomer) {
  const kasapos = normalizeText(item.kasapos_firmasi);
  const other = normalizeText(`${item.kasapos_firmasi} ${item.sabit_bilgisayar_markasi} ${item.entegrasyon_tipi}`);
  if (kasapos.includes('nebim')) return 'Nebim';
  if (kasapos.includes('toshiba')) return 'Toshiba';
  if (includesAny(other, ['encore', 'enpos', 'logo', 'microsoft dynamics'])) return 'Encore / EnPOS / Logo / Dynamics';
  return 'Encore / EnPOS / Logo / Dynamics';
}


const RISK_ACCENT_RED = 'FF0000';
const RISK_ACCENT_OLD_COLORS = ['FFC000', 'FDB913'];

const STATIC_TEMPLATE_SLIDE_NOS = [15];
const BUSINESS_PARTNER_PROGRESS_TITLE = 'İş Ortakları - Entegrasyon Durumları';


async function recolorRiskSlideDecorations(zip: JSZip, slideNo: number) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (file) {
    let xml = await file.async('string');
    for (const oldColor of RISK_ACCENT_OLD_COLORS) {
      xml = xml.replace(new RegExp(`srgbClr val="${oldColor}"`, 'g'), `srgbClr val="${RISK_ACCENT_RED}"`);
    }
    zip.file(fileName, xml);
  }

  const relFile = zip.file(`ppt/slides/_rels/slide${slideNo}.xml.rels`);
  if (!relFile) return;
  const relXml = await relFile.async('string');
  const svgTargets = Array.from(relXml.matchAll(/Target="\.\.\/media\/([^"]+\.svg)"/g)).map((match) => `ppt/media/${match[1]}`);
  for (const svgPath of svgTargets) {
    const svgFile = zip.file(svgPath);
    if (!svgFile) continue;
    let svg = await svgFile.async('string');
    for (const oldColor of RISK_ACCENT_OLD_COLORS) {
      svg = svg
        .replace(new RegExp(`#${oldColor}`, 'g'), `#${RISK_ACCENT_RED}`)
        .replace(new RegExp(oldColor, 'g'), RISK_ACCENT_RED);
    }
    zip.file(svgPath, svg);
  }
}


const PHASE_GROUP_ORDER = ['Fırsat', 'İlk Temas', 'Business', 'Operasyon', 'Yayılım'];

function phaseDisplay(phaseNo: number | null | undefined, phaseName?: string | null) {
  if (phaseNo == null) return 'Faz bilgisi yok';
  const cleanName = trimText(phaseName, '');
  return cleanName ? `Faz ${phaseNo} - ${cleanName}` : `Faz ${phaseNo}`;
}

function phaseGroupDisplay(item: Pick<PresentationCustomer, 'phase_group' | 'phase_no' | 'phase_name'>) {
  return trimText(item.phase_group, phaseDisplay(item.phase_no, item.phase_name));
}

function phaseStatusDisplay(item: PresentationCustomer) {
  return trimText((item as any).phase_status, '-');
}

function latestActivityDateDisplay(item: PresentationCustomer) {
  const value = trimText((item as any).latest_activity_date, '-');
  if (!value || value === '-') return '-';
  return formatDateDots(value);
}
function latestActivitySortValue(item: PresentationCustomer) {
  const raw = trimText((item as any).latest_activity_date, '');
  if (!raw || raw === '-') return 0;
  const time = Date.parse(raw.includes('T') ? raw : `${raw}T00:00:00`);
  return Number.isFinite(time) ? time : 0;
}

function compareByLatestActivityDesc(a: PresentationCustomer, b: PresentationCustomer) {
  const dateDiff = latestActivitySortValue(b) - latestActivitySortValue(a);
  if (dateDiff !== 0) return dateDiff;
  return a.customer.localeCompare(b.customer, 'tr');
}

function quoteStatusDisplay(item: PresentationCustomer) {
  const quoteNumbers = Array.isArray((item as any).quote_numbers) ? (item as any).quote_numbers : [];
  const text = quoteNumbers.map((quoteNo: unknown) => trimText(quoteNo, '')).filter(Boolean).join(', ');
  return text || '-';
}

function storeCountDisplay(item: PresentationCustomer) {
  const rawText = trimText((item as any).store_count_text, '');
  if (rawText && rawText !== '-') return rawText;
  return item.store_count != null ? formatNumber(toNumber(item.store_count)) : '-';
}

type SegmentReportSummary = {
  totalPos: number;
  customerCount: number;
  completedPhaseCount: number;
  activePhaseCount: number;
  quoteDeviceText: string;
};

function isCompletedPhase(item: PresentationCustomer) {
  const status = normalizeText((item as any).phase_status);
  return status.includes('tamam') || status.includes('completed') || toNumber(item.phase_no) >= 24;
}

function isActivePhase(item: PresentationCustomer) {
  const status = normalizeText((item as any).phase_status);
  if (status.includes('devam') || status.includes('active')) return true;
  if (isCompletedPhase(item)) return false;
  return item.phase_no != null;
}

function quoteDeviceItems(item: PresentationCustomer): Array<{ label: string; quantity: number }> {
  const items = Array.isArray((item as any).quote_device_items) ? (item as any).quote_device_items : [];
  return items
    .map((row: any) => ({ label: trimText(row?.label, ''), quantity: toNumber(row?.quantity) }))
    .filter((row: { label: string; quantity: number }) => row.label && row.quantity > 0);
}

function buildSegmentReportSummary(customers: PresentationCustomer[]): SegmentReportSummary {
  const deviceMap = new Map<string, number>();
  for (const customer of customers) {
    for (const item of quoteDeviceItems(customer)) {
      deviceMap.set(item.label, (deviceMap.get(item.label) ?? 0) + item.quantity);
    }
  }

  const deviceText = Array.from(deviceMap.entries())
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, 'tr'))
    .slice(0, 4)
    .map((item) => `${item.label}: ${formatNumber(item.quantity)}`)
    .join(' / ');

  return {
    totalPos: customers.reduce((total, item) => total + toNumber(item.pos_count), 0),
    customerCount: new Set(customers.map((item) => item.musteri_id || item.customer).filter(Boolean)).size,
    completedPhaseCount: customers.filter(isCompletedPhase).length,
    activePhaseCount: customers.filter(isActivePhase).length,
    quoteDeviceText: deviceText || '-',
  };
}

function getDistributionReportCustomers(payload: WeeklyManagementPresentationPayload) {
  return payload.customers
    .filter((customer) => customer.kunye_status === 'Var')
    .filter((customer) => isDistributionChannelSector(customer.sector))
    .filter((customer) => !isExcludedKasaPos(customer.kasapos_firmasi))
    .sort(compareByLatestActivityDesc);
}

function hasGeneralReportActivity(item: PresentationCustomer) {
  const date = trimText(item.latest_activity_date, '');
  return Boolean(date && date !== '-');
}

function kasaposFirmReportValue(item: PresentationCustomer) {
  const kasaposFirm = pickDistributionLabel(item.kasapos_firmasi);
  return kasaposFirm || 'Diğer';
}

function getKasaposFirmReportCustomers(payload: WeeklyManagementPresentationPayload, firmName: string) {
  const target = normalizeText(firmName);
  const isOtherReport = isOtherKasaposFirm(firmName);
  return payload.customers
    .filter(hasGeneralReportActivity)
    .filter((item) => normalizeText(kasaposFirmReportValue(item)) === target)
    .filter((item) => !isOtherReport || !isExcludedFromOtherKasaposReportSector(item.sector))
    .sort(compareByLatestActivityDesc);
}

type SegmentTableRow = {
  company: string;
  phaseLabel: string;
  phaseStatus: string;
  activityDate: string;
  computer: string;
  posModel: string;
  storeCount: string;
  eftPosBrand: string;
  totalPos: string;
  quoteStatus: string;
};

type DistributionTableRow = {
  company: string;
  phaseLabel: string;
  phaseStatus: string;
  activityDate: string;
  kasaposFirm: string;
  computerBrand: string;
  storeCount: string;
  eftPosBrand: string;
  totalPos: string;
  quoteStatus: string;
};

type KasaposIntegrationRow = {
  no: string;
  software: string;
  integrationType: string;
  pilotCustomer: string;
  phase: string;
  owner: string;
  department: string;
  status: string;
};

function buildSegmentTableRows(payload: WeeklyManagementPresentationPayload, segment: 'Nebim' | 'Toshiba' | 'Encore / EnPOS / Logo / Dynamics') {
  return payload.customers
    .filter((item) => item.kunye_status === 'Var')
    .filter((item) => segmentName(item) === segment)
    .filter((item) => {
      // 10. sayfa (Nebim/Toshiba harici) listesinde dağıtım ve lojistik sektörleri yer almamalı.
      // Bu müşteriler, ilgili sektör tablosunda ayrı ele alınıyor.
      if (segment !== 'Encore / EnPOS / Logo / Dynamics') return true;
      return !isDistributionChannelSector(item.sector);
    })
    .sort(compareByLatestActivityDesc)
    .map((item) => ({
      company: trimText(item.customer, '-'),
      phaseLabel: phaseDisplay(item.phase_no, item.phase_name),
      phaseStatus: phaseStatusDisplay(item),
      activityDate: latestActivityDateDisplay(item),
      computer: trimText(item.sabit_bilgisayar_markasi, '-'),
      posModel: trimText(item.pos_modeli, '-'),
      storeCount: storeCountDisplay(item),
      eftPosBrand: trimText(item.pos_markasi, '-'),
      totalPos: item.pos_count != null ? formatNumber(toNumber(item.pos_count)) : '-',
      quoteStatus: quoteStatusDisplay(item),
    }));
}

const KASAPOS_GENERAL_REPORT_ORDER = [
  'Toshiba',
  'Nebim',
  'Enpos',
  'Echopos',
  'Posback',
  'Barsoft',
  'Avion',
  'Logo',
  'Smartpos',
  'Protel',
  'Inhouse',
  'Diğer',
];

function normalizeKasaposOrderKey(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function kasaposGeneralReportOrderRank(value: unknown) {
  const normalized = normalizeKasaposOrderKey(value);
  if (!normalized) return KASAPOS_GENERAL_REPORT_ORDER.length + 1;

  const aliases: Array<[string, string[]]> = [
    ['Toshiba', ['toshiba']],
    ['Nebim', ['nebim']],
    ['Enpos', ['enpos', 'en pos']],
    ['Echopos', ['echopos', 'echo pos']],
    ['Posback', ['posback', 'pos back']],
    ['Barsoft', ['barsoft', 'bar soft']],
    ['Avion', ['avion']],
    ['Logo', ['logo']],
    ['Smartpos', ['smartpos', 'smart pos']],
    ['Protel', ['protel']],
    ['Inhouse', ['inhouse', 'in house']],
    ['Diğer', ['diger', 'digerleri', 'other']],
  ];

  const matchedIndex = aliases.findIndex(([, tokens]) => tokens.some((token) => normalized.includes(token)));
  return matchedIndex >= 0 ? matchedIndex : KASAPOS_GENERAL_REPORT_ORDER.length;
}

function kasaposFirmDisplayName(value: unknown) {
  const text = trimText(value, '');
  if (!text || text === '-') return '';
  return text;
}

function buildKasaposFirmReportRows(payload: WeeklyManagementPresentationPayload, firmName: string) {
  return getKasaposFirmReportCustomers(payload, firmName)
    .map((item) => ({
      company: trimText(item.customer, '-'),
      phaseLabel: phaseDisplay(item.phase_no, item.phase_name),
      phaseStatus: phaseStatusDisplay(item),
      activityDate: latestActivityDateDisplay(item),
      computer: trimText(item.sabit_bilgisayar_markasi, '-'),
      posModel: trimText(item.pos_modeli, '-'),
      storeCount: storeCountDisplay(item),
      eftPosBrand: trimText(item.pos_markasi, '-'),
      totalPos: item.pos_count != null ? formatNumber(toNumber(item.pos_count)) : '-',
      quoteStatus: quoteStatusDisplay(item),
    }));
}

function buildKasaposFirmReportGroups(payload: WeeklyManagementPresentationPayload) {
  const names = Array.from(new Set(
    payload.customers
      .filter(hasGeneralReportActivity)
      .map((item) => kasaposFirmDisplayName(kasaposFirmReportValue(item)))
      .filter(Boolean),
  ));

  return names
    .map((firmName) => ({
      firmName,
      customers: getKasaposFirmReportCustomers(payload, firmName),
      rows: buildKasaposFirmReportRows(payload, firmName),
    }))
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => {
      const rankDiff = kasaposGeneralReportOrderRank(a.firmName) - kasaposGeneralReportOrderRank(b.firmName);
      if (rankDiff !== 0) return rankDiff;
      return a.firmName.localeCompare(b.firmName, 'tr');
    });
}

function kasaposFirmReportTitle(firmName: string) {
  return `${firmName} Kullanan Firmaların Genel Durum Raporu`;
}

function buildCustomerContext(item: PresentationCustomer) {
  const chunks: string[] = [];
  if (toNumber(item.store_count) > 0) chunks.push(`${formatNumber(toNumber(item.store_count))} mağaza`);
  if (toNumber(item.pos_count) > 0) chunks.push(`${formatNumber(toNumber(item.pos_count))} kasa`);
  if (item.phase_name) chunks.push(item.phase_name);
  else if (item.phase_group) chunks.push(item.phase_group);
  return chunks.join(' / ');
}

function buildLatestActivityMap(activities: ActivityRow[]) {
  const map = new Map<string, ActivityRow>();
  for (const item of activities) {
    if (!map.has(item.customer)) map.set(item.customer, item);
  }
  return map;
}

function buildCustomerMap(customers: PresentationCustomer[]) {
  return new Map(customers.map((item) => [item.customer, item]));
}

function customerLine(item: PresentationCustomer, activity?: ActivityRow | { note?: string; waiting?: string; phase?: string }) {
  const ctx = buildCustomerContext(item);
  const activityNote = activity && 'note' in activity ? activity.note : (activity as ActivityRow | undefined)?.notes;
  const note = trimText(activityNote ?? '', 'Takip sürüyor.');
  return `${item.customer}: ${ctx ? `${ctx}; ` : ''}${truncate(note, 180)}`;
}

function activityLine(item: { customer: string; note: string }, customerMap: Map<string, PresentationCustomer>) {
  const customer = customerMap.get(item.customer);
  const ctx = customer ? buildCustomerContext(customer) : '';
  return `${item.customer}: ${ctx ? `${ctx}; ` : ''}${truncate(item.note, 180)}`;
}

function buildSectionWithHeading(heading: string, lines: string[]) {
  const body = joinNarrative(lines, 1600);
  if (!body) return `${heading}: Veri bulunmuyor.`;
  return `${heading}: ${body}`;
}

function activityCategory(row: ActivityRow) {
  if (row.is_blocked || trimText(row.blocked_note, '')) return 'risk';
  const text = normalizeText(`${row.status} ${row.notes} ${row.blocked_note}`);
  if (includesAny(text, ['tamam', 'sipariş', 'teslim', 'yaygınlaştır', 'kazan', 'kapandı', 'devreye'])) return 'completed';
  if (includesAny(text, ['blokaj', 'kritik', 'risk', 'bekli', 'problem', 'muafiyet'])) return 'risk';
  if (includesAny(text, ['poc', 'pilot', 'test'])) return 'pilot';
  return 'progress';
}

type WeeklyProgressEntry =
  | { kind: 'heading'; title: string; count: number }
  | { kind: 'row'; section: string; item: WeeklyActivityNarrativeItem }
  | { kind: 'empty'; section: string; text: string };

function weeklyActivityDateMs(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isNotStartedWeeklyActivityStatus(value: unknown) {
  const normalized = normalizeResponsible(value);
  return normalized === 'baslamadi'
    || normalized === 'not started'
    || normalized === 'not_started'
    || normalized === 'planlandi'
    || normalized.includes('baslamadi');
}

function weeklyActivityRowKey(row: ActivityRow) {
  return trimText(row.musteri_id || row.customer, '');
}

function weeklyActivityRowPhaseKey(row: ActivityRow) {
  const customerKey = weeklyActivityRowKey(row);
  const phaseKey = row.phase_no != null ? String(row.phase_no) : trimText(row.phase_name || row.phase || '-', '-');
  return `${customerKey}__${phaseKey}`;
}

function activityRowToNarrativeItem(row: ActivityRow, fallbackNote: string): WeeklyActivityNarrativeItem {
  return {
    customer: trimText(row.customer, '-'),
    note: trimText(row.notes, fallbackNote),
    owner: trimText(row.created_by, '-'),
    phase: trimText(row.phase, '-'),
    phase_no: row.phase_no,
    phase_name: row.phase_name,
    phase_status: trimText(row.status, '-'),
    waiting: trimText(row.waiting, '-'),
    created_at: trimText(row.created_at, ''),
    activity_type: trimText(row.activity_type, '-'),
    affects_phase: Boolean(row.affects_phase),
  };
}

function buildWeeklyBusinessPartnerActivityItems(payload: WeeklyManagementPresentationPayload): WeeklyActivityNarrativeItem[] {
  const businessPartnerResponsible = normalizeResponsible(BUSINESS_PARTNER_RESPONSIBLE);
  const rows = (payload.activities ?? [])
    .filter((row) => normalizeResponsible(row.responsible) === businessPartnerResponsible)
    .filter((row) => !isNotStartedWeeklyActivityStatus(row.status))
    .sort((a, b) => {
      const dateDiff = weeklyActivityDateMs(b.created_at) - weeklyActivityDateMs(a.created_at);
      return dateDiff || trimText(a.customer, '').localeCompare(trimText(b.customer, ''), 'tr');
    });

  const uniqueRows = new Map<string, ActivityRow>();
  for (const row of rows) {
    const key = weeklyActivityRowPhaseKey(row);
    if (key && !uniqueRows.has(key)) uniqueRows.set(key, row);
  }

  return Array.from(uniqueRows.values())
    .map((row) => activityRowToNarrativeItem(row, 'Sorumlusu İş Ortakları olan müşteri aktivitesi.'))
    .slice(0, 200);
}

function buildWeeklyBusinessPartnerCustomerKeys(payload: WeeklyManagementPresentationPayload): Set<string> {
  const businessPartnerResponsible = normalizeResponsible(BUSINESS_PARTNER_RESPONSIBLE);
  return new Set(
    (payload.activities ?? [])
      .filter((row) => normalizeResponsible(row.responsible) === businessPartnerResponsible)
      .map((row) => normalizeResponsible(row.customer))
      .filter(Boolean),
  );
}

function withoutWeeklyBusinessPartnerItems(
  payload: WeeklyManagementPresentationPayload,
  items: WeeklyActivityNarrativeItem[] = [],
): WeeklyActivityNarrativeItem[] {
  const businessPartnerCustomers = buildWeeklyBusinessPartnerCustomerKeys(payload);
  if (!businessPartnerCustomers.size) return items;
  return items.filter((item) => !businessPartnerCustomers.has(normalizeResponsible(item.customer)));
}

function weeklyActivityDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10) || '-';
  return formatDateDots(toIsoDate(date));
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weeklyActivityPhaseLabel(item: WeeklyActivityNarrativeItem) {
  if (item.phase_no == null) return trimText(item.phase, 'Faz bilgisi yok');
  const phaseName = trimText(item.phase_name, '');
  return phaseName ? `Faz ${item.phase_no} - ${phaseName}` : `Faz ${item.phase_no}`;
}

function isWeeklyBusinessPartnerCustomer(payload: WeeklyManagementPresentationPayload, customer: unknown) {
  const businessPartnerCustomers = buildWeeklyBusinessPartnerCustomerKeys(payload);
  return businessPartnerCustomers.has(normalizeResponsible(customer));
}

function filterWeeklyBusinessPartnerItems(
  payload: WeeklyManagementPresentationPayload,
  items: WeeklyActivityNarrativeItem[] = [],
  mode: 'only' | 'without',
): WeeklyActivityNarrativeItem[] {
  const businessPartnerCustomers = buildWeeklyBusinessPartnerCustomerKeys(payload);
  if (!businessPartnerCustomers.size) return mode === 'only' ? [] : items;
  return items.filter((item) => {
    const isBusinessPartner = businessPartnerCustomers.has(normalizeResponsible(item.customer));
    return mode === 'only' ? isBusinessPartner : !isBusinessPartner;
  });
}

function buildWeeklyProgressUniqueFirms(payload: WeeklyManagementPresentationPayload, mode: 'normal' | 'businessPartner' = 'normal'): string[] {
  // Bu sayfada gösterilen ilerleme / ilk temas / teknik aktivite kayıtlarından
  // firma adlarını tekilleştirip en sonda toplu bilgi olarak gösteriyoruz.
  const itemFilterMode = mode === 'businessPartner' ? 'only' : 'without';
  const weeklyNewContacts = filterWeeklyBusinessPartnerItems(payload, payload.weeklyNewContacts ?? [], itemFilterMode);
  const weeklyPhaseChangedProgress = filterWeeklyBusinessPartnerItems(payload, payload.weeklyPhaseChangedProgress ?? [], itemFilterMode);
  const weeklyPhaseUnchangedProgress = filterWeeklyBusinessPartnerItems(payload, payload.weeklyPhaseUnchangedProgress ?? [], itemFilterMode);
  const weeklyTechnicalActivities = filterWeeklyBusinessPartnerItems(payload, payload.weeklyTechnicalActivities ?? [], itemFilterMode);
  const weeklyCompleted = filterWeeklyBusinessPartnerItems(payload, payload.weeklyCompleted ?? [], itemFilterMode);

  const sourceItems = [
    ...weeklyNewContacts,
    ...weeklyPhaseChangedProgress,
    ...weeklyPhaseUnchangedProgress,
    ...weeklyTechnicalActivities,
    ...weeklyCompleted,
  ];

  const firmNames = sourceItems
    .map((item) => trimText(item.customer, ''))
    .filter((name): name is string => Boolean(name));

  return Array.from(new Set<string>(firmNames)).sort((a, b) => a.localeCompare(b, 'tr'));
}

function buildWeeklyProgressEntries(payload: WeeklyManagementPresentationPayload, mode: 'normal' | 'businessPartner' = 'normal') {
  const itemFilterMode = mode === 'businessPartner' ? 'only' : 'without';
  const weeklyNewContacts = filterWeeklyBusinessPartnerItems(payload, payload.weeklyNewContacts ?? [], itemFilterMode);
  const weeklyPhaseChangedProgress = filterWeeklyBusinessPartnerItems(payload, payload.weeklyPhaseChangedProgress ?? [], itemFilterMode);
  const weeklyPhaseUnchangedProgress = filterWeeklyBusinessPartnerItems(payload, payload.weeklyPhaseUnchangedProgress ?? [], itemFilterMode);
  const weeklyTechnicalActivities = filterWeeklyBusinessPartnerItems(payload, payload.weeklyTechnicalActivities ?? [], itemFilterMode);

  const sections: Array<{ title: string; items: WeeklyActivityNarrativeItem[]; empty: string }> = [
    {
      title: 'İlk Temaslar',
      items: weeklyNewContacts,
      empty: mode === 'businessPartner'
        ? 'Bu tarih aralığında İş Ortakları için Faz 2 / Faz 3 / Faz 4 ilk yerinde ziyaret kaydı bulunmuyor.'
        : 'Bu tarih aralığında Faz 2 / Faz 3 / Faz 4 ilk yerinde ziyaret kaydı bulunmuyor.',
    },
    {
      title: 'Faz Değişikliği Olan Aktiviteler',
      items: weeklyPhaseChangedProgress,
      empty: mode === 'businessPartner'
        ? 'Bu tarih aralığında İş Ortakları için faz değişikliği olan aktivite bulunmuyor.'
        : 'Bu tarih aralığında faz değişikliği olan aktivite bulunmuyor.',
    },
    {
      title: 'Faz Değişikliği Olmamış Aktiviteler',
      items: weeklyPhaseUnchangedProgress,
      empty: mode === 'businessPartner'
        ? 'Bu tarih aralığında İş Ortakları için faz değişikliği olmayan aktivite bulunmuyor.'
        : 'Bu tarih aralığında faz değişikliği olmayan aktivite bulunmuyor.',
    },
    {
      title: 'Teknik Aktiviteler',
      items: weeklyTechnicalActivities,
      empty: mode === 'businessPartner'
        ? 'Bu tarih aralığında İş Ortakları için Teknik Online / Teknik Ziyaret / POM kaydı bulunmuyor.'
        : 'Bu tarih aralığında Teknik Online / Teknik Ziyaret / POM kaydı bulunmuyor.',
    },
  ];

  const entries: WeeklyProgressEntry[] = [];
  for (const section of sections) {
    entries.push({ kind: 'heading', title: section.title, count: section.items.length });
    if (section.items.length) {
      for (const item of section.items) entries.push({ kind: 'row', section: section.title, item });
    } else {
      entries.push({ kind: 'empty', section: section.title, text: section.empty });
    }
  }

  // Tekil firma bilgisi bu slaytta liste olarak basilmaz.
  // Kullanici istegi: sadece ust bilgi kartlarinda toplam tekil firma sayisi gosterilsin.
  return entries;
}

function paginateWeeklyProgressEntries(entries: WeeklyProgressEntry[]) {
  const pages: WeeklyProgressEntry[][] = [];
  let current: WeeklyProgressEntry[] = [];
  let units = 0;
  // Bu sayfada ust bilgi kartlari ve daha buyuk font kullanildigi icin
  // onceki 14 birimlik kapasite fazla geliyor ve ek kayıtlar tek sayfada kalabiliyordu.
  // Kapasiteyi dusurerek yeni sayfa olusumunu tekrar aktif tutuyoruz.
  const maxUnits = 15;

  const unitFor = (entry: WeeklyProgressEntry) => {
    if (entry.kind === 'heading') return 1.2;
    return 1;
  };
  const pushPage = () => {
    if (current.length) pages.push(current);
    current = [];
    units = 0;
  };

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const next = entries[i + 1];
    const needed = unitFor(entry) + (entry.kind === 'heading' && next && next.kind !== 'heading' ? unitFor(next) : 0);
    if (current.length && units + needed > maxUnits) pushPage();
    current.push(entry);
    units += unitFor(entry);
  }
  pushPage();
  return pages.length ? pages : [[{ kind: 'empty' as const, section: 'Kayıt', text: 'Bu hafta ilerleme, yeni temaslar notu bulunmuyor.' }]];
}

function buildWeeklyProgressPages(payload: WeeklyManagementPresentationPayload, mode: 'normal' | 'businessPartner' = 'normal') {
  return paginateWeeklyProgressEntries(buildWeeklyProgressEntries(payload, mode));
}

function buildWeeklyHighlightPageLines(payload: WeeklyManagementPresentationPayload, customerMap: Map<string, PresentationCustomer>) {
  const lines = payload.weeklyNewContacts
    .map((item) => activityLine(item, customerMap))
    .filter((line) => trimText(line).length > 0);
  if (!lines.length) return [['Bu hafta ilerleme, yeni temaslar notu bulunmuyor..']];
  return paginateByCount(lines, 8, 2);
}


function buildWeeklyHighlightPageCounts(payload: WeeklyManagementPresentationPayload, customerMap: Map<string, PresentationCustomer>) {
  return buildWeeklyHighlightPageLines(payload, customerMap).map((pageItems) => pageItems.length);
}

function buildWeeklyRiskLines(payload: WeeklyManagementPresentationPayload, customerMap: Map<string, PresentationCustomer>) {
  // Ticari Riskler sayfasında manuel cihaz/faz/konsinye metni oluşturma.
  // Aktivite dashboardında girilen gerçek blokaj notunu firma bazında sade şekilde göster.
  return payload.weeklyRisks
    .map((item) => {
      const customer = trimText(item.customer, '');
      const note = trimText(item.note, '');
      if (!note) return '';
      return customer ? `• ${customer}: ${note}` : `• ${note}`;
    })
    .filter((line) => trimText(line).length > 1);
}


function activitiesForSegment(payload: WeeklyManagementPresentationPayload, segment: 'Nebim' | 'Toshiba' | 'Encore / EnPOS / Logo / Dynamics') {
  const customerMap = buildCustomerMap(payload.customers);
  return payload.activities.filter((row) => {
    const customer = customerMap.get(row.customer);
    return customer ? segmentName(customer) === segment : false;
  });
}

function buildSegmentActivityPages(
  payload: WeeklyManagementPresentationPayload,
  segment: 'Nebim' | 'Toshiba' | 'Encore / EnPOS / Logo / Dynamics',
  customerMap: Map<string, PresentationCustomer>,
  maxChars = 2000,
) {
  const lines = activitiesForSegment(payload, segment).map((activity) => {
    const customer = customerMap.get(activity.customer);
    if (!customer) return `${activity.customer}: ${truncate(activity.blocked_note || activity.notes, 180)}`;
    const note = activity.blocked_note || activity.notes || activity.status || 'Takip sürüyor.';
    return customerLine(customer, { note, waiting: activity.waiting, phase: activity.phase });
  });
  const pages: string[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const bucket: string[] = [];
    let size = 0;
    while (cursor < lines.length) {
      const item = trimText(lines[cursor]);
      const next = size + item.length + 3;
      if (bucket.length > 0 && next > maxChars) break;
      bucket.push(item);
      size = next;
      cursor += 1;
    }
    pages.push(bucket.join('  '));
  }
  return pages.length ? pages : ['Veri bulunmuyor.'];
}

function buildSimpleSegmentSection(payload: WeeklyManagementPresentationPayload, segment: 'Toshiba' | 'Encore / EnPOS / Logo / Dynamics', customerMap: Map<string, PresentationCustomer>, maxChars = 1900) {
  return truncate(buildSegmentActivityPages(payload, segment, customerMap, maxChars)[0] || 'Veri bulunmuyor.', maxChars);
}

function buildDistributionSection(payload: WeeklyManagementPresentationPayload, customerMap: Map<string, PresentationCustomer>) {
  const items = payload.activities
    .filter((activity) => {
      const customer = customerMap.get(activity.customer);
      const sector = normalizeText(customer?.sector || activity.sector);
      return includesAny(sector, ['fmcg', 'fmcg dağıtım', 'dağıtım', 'dagitim', 'zincir']);
    })
    .map((activity) => {
      const customer = customerMap.get(activity.customer);
      return customer ? customerLine(customer, { note: activity.blocked_note || activity.notes }) : `${activity.customer}: ${truncate(activity.blocked_note || activity.notes, 160)}`;
    });
  return truncate(joinNarrative(items, 2100), 2100) || 'Veri bulunmuyor.';
}

function buildDistributionTableRows(payload: WeeklyManagementPresentationPayload, mode: 'management' | 'seller' = 'management'): DistributionTableRow[] {
  // Yönetim sunumunda mevcut dağıtım/zincir raporu kuralı korunur.
  // Satışçı sunumunda Account Müşterileri Genel Durum Raporu tarih/aktivite/faz
  // filtresine takılmadan seçilen account'un sorumlu olduğu TÜM müşterileri gösterir.
  // Tarih filtresi sunumdaki aktivite/metrik slaytlarını etkiler; bu ana müşteri envanteri
  // ise alanlar boş olsa bile account'a bağlı bütün müşterileri listeler.
  const sourceCustomers = (mode === 'seller' ? payload.customers : getDistributionReportCustomers(payload))
    .slice()
    .sort(compareByLatestActivityDesc);
  return sourceCustomers
    .map((customer) => ({
      company: trimText(customer.customer, '-'),
      phaseLabel: phaseDisplay(customer.phase_no, customer.phase_name),
      phaseStatus: phaseStatusDisplay(customer),
      activityDate: latestActivityDateDisplay(customer),
      kasaposFirm: trimText(customer.kasapos_firmasi, '-'),
      computerBrand: trimText(customer.sabit_bilgisayar_markasi, '-'),
      storeCount: storeCountDisplay(customer),
      eftPosBrand: trimText(customer.pos_markasi, '-'),
      totalPos: customer.pos_count != null ? formatNumber(toNumber(customer.pos_count)) : '-',
      quoteStatus: quoteStatusDisplay(customer),
    }));
}

function buildMondayBoard(payload: WeeklyManagementPresentationPayload) {
  const lines: string[] = [];
  payload.weeklyCompleted.slice(0, 4).forEach((item) => lines.push(`Tamamlanan: ${item.customer} - ${truncate(item.note, 140)}`));
  payload.weeklyRisks.slice(0, 4).forEach((item) => lines.push(`Kritik takip: ${item.customer} - ${truncate(item.note, 140)}`));
  payload.weeklyHighlights.slice(0, 4).forEach((item) => lines.push(`İlerleme: ${item.customer} - ${truncate(item.note, 140)}`));
  payload.weeklyNewContacts.slice(0, 4).forEach((item) => lines.push(`Yeni temas: ${item.customer} - ${truncate(item.note, 140)}`));
  return truncate(joinNarrative(lines, 2200), 2200);
}

function buildKasaposStatus(payload: WeeklyManagementPresentationPayload) {
  const dist = payload.kasaposDistribution.slice(0, 6).map((item) => `${item.label}: ${formatNumber(item.value)} hesap`);
  const risks = payload.weeklyRisks
    .filter((item) => /entegr|ticket|platform|tms|vuk|kasapos/i.test(item.note))
    .slice(0, 6)
    .map((item) => `${item.customer}: ${truncate(item.note, 140)}`);
  const partA = buildSectionWithHeading('KasaPOS firma dağılımı', dist);
  const partB = buildSectionWithHeading('Entegrasyon ve süreç başlıkları', risks);
  return truncate(`${partA}  ${partB}`, 2200);
}

function buildKasaposIntegrationRows(payload: WeeklyManagementPresentationPayload, customerMap: Map<string, PresentationCustomer>): KasaposIntegrationRow[] {
  const relevant = payload.activities
    .filter((item) => {
      const haystack = normalizeText([item.integration, item.notes, item.blocked_note, item.status, item.activity_type].join(' '));
      return includesAny(haystack, ['kasapos', 'kasa pos', 'entegrasyon', 'entegr', 'a2a', 'tms', 'vuk', 'platform']);
    })
    .slice(0, 60);

  if (relevant.length) {
    return relevant.map((item, index) => {
      const customer = customerMap.get(item.customer);
      return {
        no: String(index + 1),
        software: trimText(item.integration || customer?.kasapos_firmasi, '-'),
        integrationType: trimText(item.activity_type, '-'),
        pilotCustomer: trimText(item.customer, '-'),
        phase: phaseDisplay(item.phase_no ?? customer?.phase_no, item.phase || customer?.phase_name),
        owner: trimText(item.responsible || customer?.owner, '-'),
        department: trimText(item.waiting, '-'),
        status: trimText(item.status || item.blocked_note || item.notes, '-'),
      };
    });
  }

  return payload.kasaposDistribution.slice(0, 60).map((item, index) => ({
    no: String(index + 1),
    software: trimText(item.label, '-'),
    integrationType: '-',
    pilotCustomer: '-',
    phase: '-',
    owner: '-',
    department: '-',
    status: formatNumber(item.value) + ' hesap',
  }));
}
function buildRetailSupportSummary(payload: WeeklyManagementPresentationPayload) {
  const waitingSummary = summarizeCounts(payload.activities.map((item) => item.waiting || 'Belirsiz')).slice(0, 5)
    .map((item) => `${item.label}: ${formatNumber(item.value)}`);
  const recent = payload.activities.slice(0, 8).map((item) => `${item.customer}: ${truncate(item.blocked_note || item.notes, 120)}`);
  return truncate(
    `Haftalık özet: ${formatNumber(payload.summary.weeklyActivities)} aktivite, ${formatNumber(payload.summary.activePeople)} aktif kişi. ` +
    `${buildSectionWithHeading('Bekleyen taraf dağılımı', waitingSummary)}  ${buildSectionWithHeading('Öne çıkan destek başlıkları', recent)}`,
    2200,
  );
}

function formatActualTarget(actual: number, target?: number) {
  const safeActual = Number(actual ?? 0) || 0;
  const safeTarget = Number(target ?? 0) || 0;
  return safeTarget > 0 ? `${formatNumber(safeActual)} / ${formatNumber(safeTarget)}` : formatNumber(safeActual);
}

function contactTargetStatusFill(actual: number, target: number | undefined, defaultFill: string, isTotal = false) {
  const safeActual = Number(actual ?? 0) || 0;
  const safeTarget = Number(target ?? 0) || 0;
  if (isTotal || safeTarget <= 0) return defaultFill;
  if (safeActual < safeTarget) return 'FEE2E2';
  if (safeActual === safeTarget) return 'DBEAFE';
  return 'DCFCE7';
}

function buildContactedCustomers(payload: WeeklyManagementPresentationPayload, options?: { showTargetsInSummary?: boolean }) {
  const totals = payload.contactReport.totals;
  const ownerLines = payload.contactReport.owners.slice(0, 8).map((item) => (
    `${item.owner}: Satış Fiziki ${formatActualTarget(item.salesPhysical, item.targets?.salesPhysical)}, Satış Online ${formatActualTarget(item.salesOnline, item.targets?.salesOnline)}, Satış Telefon ${formatActualTarget(item.salesPhone, item.targets?.salesPhone)}, Satış E-posta ${formatActualTarget(item.salesEmail, item.targets?.salesEmail)}, Teknik Fiziki ${formatActualTarget(item.technicalPhysical, item.targets?.technicalPhysical)}, Teknik Online ${formatActualTarget(item.technicalOnline, item.targets?.technicalOnline)}, Toplam ${formatActualTarget(item.totalActivities, item.targets?.totalActivities)}, Tekil Firma ${formatActualTarget(item.uniqueCustomers, item.targets?.uniqueCustomers)}`
  ));
  const showTargetsInSummary = Boolean(options?.showTargetsInSummary);
  return truncate(
    `Özet: Satış Fiziki ${formatActualTarget(totals.salesPhysical, showTargetsInSummary ? totals.targets?.salesPhysical : undefined)}, Satış Online ${formatActualTarget(totals.salesOnline, showTargetsInSummary ? totals.targets?.salesOnline : undefined)}, Satış Telefon ${formatActualTarget(totals.salesPhone, showTargetsInSummary ? totals.targets?.salesPhone : undefined)}, Satış E-posta ${formatActualTarget(totals.salesEmail, showTargetsInSummary ? totals.targets?.salesEmail : undefined)}, Teknik Fiziki ${formatActualTarget(totals.technicalPhysical, showTargetsInSummary ? totals.targets?.technicalPhysical : undefined)}, Teknik Online ${formatActualTarget(totals.technicalOnline, showTargetsInSummary ? totals.targets?.technicalOnline : undefined)}, Toplam Aktivite ${formatActualTarget(totals.totalActivities, showTargetsInSummary ? totals.targets?.totalActivities : undefined)}, Tekil Firma ${formatActualTarget(totals.uniqueCustomers, showTargetsInSummary ? totals.targets?.uniqueCustomers : undefined)}.  ${joinNarrative(ownerLines, 1800)}`,
    2200,
  );
}

function buildChartItemsFromCounts(items: Array<{ label: string; value: number }>, minCount = 1) {
  const rows = items.filter((item) => trimText(item.label, '').length > 0).slice(0, 6);
  if (rows.length >= minCount) return rows;
  return [{ label: 'Veri yok', value: 0 }];
}

function phaseGroupChartData(items: PresentationCustomer[]) {
  const counts = new Map<string, number>(PHASE_GROUP_ORDER.map((label) => [label, 0]));
  for (const item of items) {
    const label = phaseGroupDisplay(item);
    if (!PHASE_GROUP_ORDER.includes(label)) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return PHASE_GROUP_ORDER.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

function updateChartXml(xml: string, categories: string[], values: number[], seriesName: string) {
  const safeCategories = categories.length ? categories.map((item) => trimText(item, 'Veri yok')) : ['Veri yok'];
  // PowerPoint "Onar" uyarısına en sık sebep olan chart cache tutarsızlıklarını
  // engelle: kategori/değer sayısı birebir aynı kalır ve tüm değerler gerçek sayıya zorlanır.
  const safeValues = safeCategories.map((_category, index) => {
    const parsed = Number(values[index] ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const catCache = `<c:ptCount val="${safeCategories.length}"/>${safeCategories.map((item, index) => `<c:pt idx="${index}"><c:v>${escapeXml(item)}</c:v></c:pt>`).join('')}`;
  const valCache = `<c:formatCode>General</c:formatCode><c:ptCount val="${safeValues.length}"/>${safeValues.map((item, index) => `<c:pt idx="${index}"><c:v>${String(item)}</c:v></c:pt>`).join('')}`;

  // Repair-safe chart data:
  // Template grafiklerinde veri cache'i Excel workbook referanslariyla (c:strRef/c:numRef)
  // geliyor. Export sirasinda workbook'u tasimadigimiz/guncellemedigimiz icin PowerPoint
  // acilista dosyayi onarmaya calisabiliyor. Grafik verisini literal cache'e
  // ceviriyoruz; boylece chart tamamen PPTX icinde, workbook baglantisiz ve tutarli kaliyor.
  xml = xml.replace(/<c:tx>[\s\S]*?<\/c:tx>/, `<c:tx><c:v>${escapeXml(seriesName)}</c:v></c:tx>`);
  xml = xml.replace(/<c:cat>[\s\S]*?<\/c:cat>/, `<c:cat><c:strLit>${catCache}</c:strLit></c:cat>`);
  xml = xml.replace(/<c:val>[\s\S]*?<\/c:val>/, `<c:val><c:numLit>${valCache}</c:numLit></c:val>`);
  return normalizeChartXmlLiterals(xml);
}


function firstChartCacheValue(cacheXml: string) {
  return cacheXml.match(/<c:pt\b[^>]*>[^]*?<c:v>([^]*?)<\/c:v>[^]*?<\/c:pt>/)?.[1] ?? '';
}

function normalizeChartXmlLiterals(xml: string) {
  // PowerPoint, workbook'u olmayan chart referanslarini (Sheet1!... c:f) bazi
  // surumlerde bozuk paket olarak aciyor. Kalan tum strRef/numRef bloklarini
  // kendi cache verisiyle literal chart dataya ceviriyoruz.
  xml = xml.replace(/<c:tx>\s*<c:strRef>[^]*?<c:strCache>([^]*?)<\/c:strCache>[^]*?<\/c:strRef>\s*<\/c:tx>/g, (_match, cache) => {
    const value = firstChartCacheValue(cache);
    return `<c:tx><c:v>${value || 'Firma'}</c:v></c:tx>`;
  });

  xml = xml.replace(/<c:strRef>[^]*?<c:strCache>([^]*?)<\/c:strCache>[^]*?<\/c:strRef>/g, (_match, cache) => (
    `<c:strLit>${cache}</c:strLit>`
  ));

  xml = xml.replace(/<c:numRef>[^]*?<c:numCache>([^]*?)<\/c:numCache>[^]*?<\/c:numRef>/g, (_match, cache) => (
    `<c:numLit>${cache}</c:numLit>`
  ));

  xml = xml
    .replace(/<c:externalData\b[^>]*\/>/g, '')
    .replace(/<c:externalData\b[^>]*>[^]*?<\/c:externalData>/g, '');

  return xml;
}

function keepBarChartValueLabelsVisible(xml: string) {
  // Kucuk degerlerde (1-2 gibi) etiket barin icinde kalirsa gorunmuyor.
  // Sayfa 4/5 faz grubu grafiklerinde degerleri barin dis ucuna alip koyu renkle yaziyoruz.
  return xml
    .replace(/<c:dLblPos val="inEnd"\/>/g, '<c:dLblPos val="outEnd"/>')
    .replace(/<c:dLblPos val="ctr"\/>/g, '<c:dLblPos val="outEnd"/>')
    .replace(
      /(<c:dLbls>[\s\S]*?<a:solidFill><a:srgbClr val=")FFFFFF("\/><\/a:solidFill>[\s\S]*?<\/c:dLbls>)/g,
      (_match, before, after) => before + '17365D' + after,
    );
}
async function applyCharts(zip: JSZip, payload: WeeklyManagementPresentationPayload) {
  const basePhaseBarChartXml = await zip.file('ppt/charts/chart3.xml')!.async('string');

  // KasaPos Pipeline Raporu slaydındaki sol alt "Faz Durumu" grafiği,
  // tamamlanan/devam eden donut yerine Fazı Tamamlanan Müşteriler slaydındaki
  // faz grubu bar yapısını kullanır. Bar chart görsel sırası PowerPoint'te
  // Yayılım > Operasyon > Business > İlk Temas > Fırsat olarak görünür.
  const pipelinePhase = phaseGroupChartData(payload.pipelineAccounts ?? payload.customers ?? []);
  const chart1 = keepBarChartValueLabelsVisible(updateChartXml(
    basePhaseBarChartXml,
    pipelinePhase.map((item) => item.label),
    pipelinePhase.map((item) => item.value),
    'Firma',
  ));
  zip.file('ppt/charts/chart1.xml', chart1);

  const brandItems = buildChartItemsFromCounts(payload.eftPosBrandDistribution.slice(0, 5));
  const chart2 = updateChartXml(
    await zip.file('ppt/charts/chart2.xml')!.async('string'),
    brandItems.map((item) => item.label),
    brandItems.map((item) => item.value),
    'Firma',
  );
  zip.file('ppt/charts/chart2.xml', chart2);

  const completedPhase = phaseGroupChartData(payload.completedPhaseChartAccounts ?? payload.completedPhaseAccounts ?? payload.topCompletedAccounts ?? []);
  const chart3 = keepBarChartValueLabelsVisible(updateChartXml(
    basePhaseBarChartXml,
    completedPhase.map((item) => item.label),
    completedPhase.map((item) => item.value),
    'Firma',
  ));
  zip.file('ppt/charts/chart3.xml', chart3);

  const activePhase = phaseGroupChartData(payload.activePhaseChartAccounts ?? payload.activePhaseAccounts ?? payload.topActiveAccounts ?? []);
  const chart4 = keepBarChartValueLabelsVisible(updateChartXml(
    await zip.file('ppt/charts/chart4.xml')!.async('string'),
    activePhase.map((item) => item.label),
    activePhase.map((item) => item.value),
    'Firma',
  ));
  zip.file('ppt/charts/chart4.xml', chart4);
}

async function rewriteSlideText(zip: JSZip, slideNo: number, replacements: Record<number, string>) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  const xml = await file.async('string');
  const matches = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g));
  if (!matches.length) return;
  const rebuilt: string[] = [];
  let lastIndex = 0;
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    rebuilt.push(xml.slice(lastIndex, start));
    const nextText = Object.prototype.hasOwnProperty.call(replacements, index) ? replacements[index]! : match[1];
    rebuilt.push(`<a:t>${escapeXml(nextText)}</a:t>`);
    lastIndex = start + match[0].length;
  });
  rebuilt.push(xml.slice(lastIndex));
  zip.file(fileName, rebuilt.join(''));
}


function buildHighlightTxBody(lines: string[], fontSize?: number) {
  const safeLines = lines.filter((line) => trimText(line).length > 0);
  const sz = fontSize ?? (safeLines.length >= 8 ? 1500 : safeLines.length >= 7 ? 1650 : 1900);
  const paragraphs = (safeLines.length ? safeLines : ['Bu hafta ilerleme, yeni temaslar notu bulunmuyor..']).map((line) => {
    const idx = line.indexOf(':');
    const head = idx === -1 ? line : line.slice(0, idx + 1);
    const tail = idx === -1 ? '' : line.slice(idx + 1).trimStart();
    return `<a:p><a:pPr><a:lnSpc><a:spcPct val="135000"/></a:lnSpc></a:pPr><a:r><a:rPr lang="tr-TR" sz="${sz}" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>${escapeXml(head)}</a:t></a:r>${tail ? `<a:r><a:rPr lang="tr-TR" sz="${sz}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t> ${escapeXml(tail)}</a:t></a:r>` : ''}<a:endParaRPr lang="tr-TR" sz="${sz}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:endParaRPr></a:p>`;
  }).join('');
  return `<p:txBody><a:bodyPr lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="ctr" wrap="square"/><a:lstStyle/>${paragraphs}</p:txBody>`;
}

async function replaceHighlightBody(zip: JSZip, slideNo: number, lines: string[], fontSize?: number) {

  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  const shapeName = slideNo === 2 ? 'TextBox 13' : '矩形: 圆角 47';
  const shapeMatch = xml.match(new RegExp(`<p:sp>[\\s\\S]*?<p:cNvPr[^>]*name="${shapeName}"[\\s\\S]*?</p:sp>`));
  if (!shapeMatch) return;
  const shapeXml = shapeMatch[0];
  const nextTxBody = buildHighlightTxBody(lines, fontSize);
  const rebuiltShape = shapeXml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, nextTxBody);
  xml = xml.replace(shapeXml, rebuiltShape);
  zip.file(fileName, xml);
}

async function clearSlideTextBox(zip: JSZip, slideNo: number, shapeName: string) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  const shapeMatch = xml.match(new RegExp(`<p:sp>[\\s\\S]*?<p:cNvPr[^>]*name="${shapeName}"[\\s\\S]*?</p:sp>`));
  if (!shapeMatch) return;
  const shapeXml = shapeMatch[0];
  const rebuiltShape = shapeXml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>');
  xml = xml.replace(shapeXml, rebuiltShape);
  zip.file(fileName, xml);
}


function removeRelationshipByTarget(xml: string, target: string) {
  return xml.replace(/<Relationship\b[^>]*\/>/g, (tag) => (tag.includes(`Target="${target}"`) ? '' : tag));
}

function getRelationshipIdByTarget(xml: string, target: string) {
  const relMatch = xml.match(/<Relationship\b[^>]*\/>/g)?.find((tag) => tag.includes(`Target="${target}"`));
  return relMatch?.match(/\bId="([^"]+)"/)?.[1] ?? '';
}

async function removeSlide(zip: JSZip, slideNo: number) {
  const slidePath = `ppt/slides/slide${slideNo}.xml`;
  const relPath = `ppt/slides/_rels/slide${slideNo}.xml.rels`;

  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  let slideRelId = '';
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    slideRelId = getRelationshipIdByTarget(relsXml, `slides/slide${slideNo}.xml`);
    zip.file('ppt/_rels/presentation.xml.rels', removeRelationshipByTarget(relsXml, `slides/slide${slideNo}.xml`));
  }

  if (slideRelId) {
    const presFile = zip.file('ppt/presentation.xml');
    if (presFile) {
      let presXml = await presFile.async('string');
      presXml = presXml.replace(/<p:sldId\b[^>]*\/>/g, (tag) => (tag.includes(`r:id=\"${slideRelId}\"`) ? '' : tag));
      zip.file('ppt/presentation.xml', presXml);
    }
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ctXml = await ctFile.async('string');
    ctXml = ctXml.replace(/<Override\b[^>]*\/>/g, (tag) => (tag.includes(`PartName=\"/ppt/slides/slide${slideNo}.xml\"`) ? '' : tag));
    zip.file('[Content_Types].xml', ctXml);
  }

  zip.remove(slidePath);
  zip.remove(relPath);
}


async function duplicateSlideAfter(zip: JSZip, sourceSlideNo: number) {
  const slideFiles = Object.keys(zip.files)
    .map((name) => {
      const match = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null);
  const nextSlideNo = (slideFiles.length ? Math.max(...slideFiles) : sourceSlideNo) + 1;
  const sourceSlidePath = `ppt/slides/slide${sourceSlideNo}.xml`;
  const sourceRelPath = `ppt/slides/_rels/slide${sourceSlideNo}.xml.rels`;
  const sourceSlideFile = zip.file(sourceSlidePath);
  if (!sourceSlideFile) return null;

  const sourceSlide = await sourceSlideFile.async('string');
  zip.file(`ppt/slides/slide${nextSlideNo}.xml`, sourceSlide);

  const sourceRelsFile = zip.file(sourceRelPath);
  if (sourceRelsFile) {
    let sourceRels = await sourceRelsFile.async('string');
    sourceRels = sourceRels.replace(/<Relationship\b[^>]*(?:notesSlide|comments|threadedComment)[^>]*\/>/g, '');
    zip.file(`ppt/slides/_rels/slide${nextSlideNo}.xml.rels`, sourceRels);
  }

  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const presFile = zip.file('ppt/presentation.xml');
  const ctFile = zip.file('[Content_Types].xml');
  if (!relsFile || !presFile || !ctFile) return nextSlideNo;

  let relsXml = await relsFile.async('string');
  const relIds = Array.from(relsXml.matchAll(/\bId="rId(\d+)"/g)).map((m) => Number(m[1]));
  const nextRelId = `rId${(relIds.length ? Math.max(...relIds) : 0) + 1}`;
  const sourceRelTag = relsXml.match(/<Relationship\b[^>]*\/>/g)?.find((tag) => tag.includes(`Target="slides/slide${sourceSlideNo}.xml"`)) ?? '';
  if (!sourceRelTag) return nextSlideNo;

  const nextRelTag = sourceRelTag
    .replace(/\bId="[^"]+"/, `Id="${nextRelId}"`)
    .replace(`slides/slide${sourceSlideNo}.xml`, `slides/slide${nextSlideNo}.xml`);
  relsXml = relsXml.replace('</Relationships>', `${nextRelTag}</Relationships>`);
  zip.file('ppt/_rels/presentation.xml.rels', relsXml);

  let presXml = await presFile.async('string');
  const slideIdNums = Array.from(presXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)).map((m) => Number(m[1]));
  const nextSlideId = (slideIdNums.length ? Math.max(...slideIdNums) : 255) + 1;
  const nextSldTag = `<p:sldId id="${nextSlideId}" r:id="${nextRelId}"/>`;
  const sourceRelId = sourceRelTag.match(/\bId="([^"]+)"/)?.[1] ?? '';
  const sourceSlideTag = sourceRelId ? presXml.match(new RegExp(`<p:sldId\\b[^>]*r:id="${escapeRegExp(sourceRelId)}"[^>]*/>`))?.[0] : '';
  if (sourceSlideTag) presXml = presXml.replace(sourceSlideTag, `${sourceSlideTag}${nextSldTag}`);
  else presXml = presXml.replace('</p:sldIdLst>', `${nextSldTag}</p:sldIdLst>`);
  zip.file('ppt/presentation.xml', presXml);

  let ctXml = await ctFile.async('string');
  const overrideTag = `<Override PartName="/ppt/slides/slide${nextSlideNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  if (!ctXml.includes(`PartName="/ppt/slides/slide${nextSlideNo}.xml"`)) {
    ctXml = ctXml.replace('</Types>', `${overrideTag}</Types>`);
  }
  zip.file('[Content_Types].xml', ctXml);
  return nextSlideNo;
}


async function moveSlideAfter(zip: JSZip, slideNo: number, afterSlideNo: number) {
  if (slideNo === afterSlideNo) return;
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const presFile = zip.file('ppt/presentation.xml');
  if (!relsFile || !presFile) return;

  const relsXml = await relsFile.async('string');
  const slideRelId = getRelationshipIdByTarget(relsXml, `slides/slide${slideNo}.xml`);
  const afterRelId = getRelationshipIdByTarget(relsXml, `slides/slide${afterSlideNo}.xml`);
  if (!slideRelId || !afterRelId) return;

  let presXml = await presFile.async('string');
  const tags = Array.from(presXml.matchAll(/<p:sldId\b[^>]*\/>/g)).map((m) => m[0]);
  const movingTag = tags.find((tag) => tag.includes(`r:id="${slideRelId}"`));
  const afterTag = tags.find((tag) => tag.includes(`r:id="${afterRelId}"`));
  if (!movingTag || !afterTag) return;

  presXml = presXml.replace(movingTag, '');
  presXml = presXml.replace(afterTag, `${afterTag}${movingTag}`);
  zip.file('ppt/presentation.xml', presXml);
}


function resolveRelationshipTarget(relFileName: string, target: string) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  // Root rels dosyası (_rels/.rels) için base dizin yoktur. Alt paket rels
  // dosyalarında ise /_rels/<owner>.rels kısmı kaldırılıp owner dizinine dönülür.
  const baseDir = relFileName.includes('/_rels/')
    ? relFileName.replace(/\/_rels\/[^/]+\.rels$/, '/')
    : '';
  return path.posix.normalize(`${baseDir}${target}`);
}

function relationshipTargetsExistingPart(zip: JSZip, relFileName: string, target: string, targetMode?: string) {
  if (!target || targetMode === 'External' || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) return true;
  return zip.file(resolveRelationshipTarget(relFileName, target)) != null;
}


function presentationSlideCountFromXml(presXml: string) {
  return (presXml.match(/<p:sldId\b[^>]*\/>/g) ?? []).length;
}

async function removePowerPointAuxiliaryParts(zip: JSZip) {
  // Notes, comments and custom slide sections are not needed in generated export.
  // When slides are removed/duplicated, these optional parts can keep stale slide
  // ids/relationships and make PowerPoint show the "Onar" warning.
  for (const name of Object.keys(zip.files)) {
    if (
      /^ppt\/notesSlides\//.test(name)
      || /^ppt\/notesMasters\//.test(name)
      || /^ppt\/comments\//.test(name)
      || /^ppt\/threadedComments\//.test(name)
      || /^ppt\/commentAuthors\.xml$/.test(name)
      || /^ppt\/people\//.test(name)
    ) {
      zip.remove(name);
    }
  }

  for (const name of Object.keys(zip.files).filter((item) => item.endsWith('.rels'))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*(?:notesSlide|notesMaster|comments|commentAuthors|threadedComment|person)[^>]*\/>/g, '');
    zip.file(name, relXml);
  }

  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    let presXml = await presFile.async('string');
    presXml = presXml
      .replace(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/g, '')
      .replace(/<p:sectionLst>[\s\S]*?<\/p:sectionLst>/g, '')
      .replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/g, '')
      .replace(/<p:photoAlbum>[\s\S]*?<\/p:photoAlbum>/g, '');
    zip.file('ppt/presentation.xml', presXml);
  }
}

async function sanitizeXmlParts(zip: JSZip) {
  for (const name of Object.keys(zip.files).filter((item) => item.endsWith('.xml') || item.endsWith('.rels'))) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    const clean = stripInvalidXmlChars(xml);
    if (clean !== xml) zip.file(name, clean);
  }
}

async function removeChartEmbeddedWorkbookLinks(zip: JSZip) {
  // PowerPoint repair warning fix:
  // The template charts keep embedded Excel workbook links under c:externalData.
  // We update chart cache XML directly, so those workbook relations become stale.
  // Removing only the external workbook links lets PowerPoint open the generated
  // PPTX without asking for "Onar" while preserving the rendered chart data.
  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/charts\/chart\d+\.xml$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    let chartXml = await file.async('string');
    chartXml = normalizeChartXmlLiterals(chartXml);
    zip.file(name, chartXml);
  }

  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/charts\/_rels\/chart\d+\.xml\.rels$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/package"[^>]*\/>/g, '');
    relXml = relXml.replace(/<Relationship\b[^>]*Target="[^"]*\/embeddings\/[^"]*"[^>]*\/>/g, '');
    zip.file(name, relXml);
  }

  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/embeddings\//.test(item))) {
    zip.remove(name);
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile && !Object.keys(zip.files).some((item) => item.endsWith('.xlsx'))) {
    let ctXml = await ctFile.async('string');
    ctXml = ctXml.replace(/<Default\b[^>]*Extension="xlsx"[^>]*\/>/g, '');
    zip.file('[Content_Types].xml', ctXml);
  }
}

async function updateExtendedProperties(zip: JSZip) {
  const appFile = zip.file('docProps/app.xml');
  const presFile = zip.file('ppt/presentation.xml');
  if (!appFile || !presFile) return;

  const presXml = await presFile.async('string');
  const slideCount = presentationSlideCountFromXml(presXml);
  let appXml = await appFile.async('string');
  const setTag = (xml: string, tag: string, value: string) => {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`);
    return re.test(xml) ? xml.replace(re, `<${tag}>${value}</${tag}>`) : xml;
  };

  appXml = setTag(appXml, 'Slides', String(slideCount));
  appXml = setTag(appXml, 'Notes', '0');
  appXml = setTag(appXml, 'HiddenSlides', '0');

  appXml = appXml.replace(
    /(<vt:lpstr>Slayt Başlıkları<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>)(\d+)(<\/vt:i4>)/,
    `$1${slideCount}$3`,
  );
  appXml = appXml.replace(
    /(<vt:lpstr>Slide Titles<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>)(\d+)(<\/vt:i4>)/,
    `$1${slideCount}$3`,
  );

  const titleMatch = appXml.match(/<TitlesOfParts>[\s\S]*?<vt:vector[^>]*>[\s\S]*?<\/vt:vector>[\s\S]*?<\/TitlesOfParts>/);
  if (titleMatch) {
    const currentItems = Array.from(titleMatch[0].matchAll(/<vt:lpstr>([\s\S]*?)<\/vt:lpstr>/g)).map((m) => m[1]);
    const prefix = currentItems.slice(0, Math.min(6, currentItems.length));
    while (prefix.length < 6) prefix.push(prefix.length === 5 ? 'Office Theme' : 'Arial');
    const items = [...prefix, ...Array.from({ length: slideCount }, () => 'PowerPoint Sunusu')];
    const vector = `<TitlesOfParts><vt:vector size="${items.length}" baseType="lpstr">${items.map((item) => `<vt:lpstr>${escapeXml(item)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>`;
    appXml = appXml.replace(titleMatch[0], vector);
  }

  zip.file('docProps/app.xml', appXml);
}


async function restoreStaticTemplateSlides(zip: JSZip, pristineZip: JSZip, slideNos = STATIC_TEMPLATE_SLIDE_NOS) {
  // Kasa Pos Entegrasyon Durumları sayfası template'te sabittir.
  // Kod tarafındaki text replacement, shape temizleme veya çoğaltma işlemleri bu
  // slaydın görselini bozmasın diye export bitmeden XML'ini template'ten
  // geri alıyoruz. Notes/comment ilişkileri görsel için gerekli değildir; Onar
  // uyarısı üretmemesi için restore ederken filtrelenir.
  for (const slideNo of slideNos) {
    const slidePath = `ppt/slides/slide${slideNo}.xml`;
    const relPath = `ppt/slides/_rels/slide${slideNo}.xml.rels`;
    const pristineSlide = pristineZip.file(slidePath);
    if (pristineSlide) {
      zip.file(slidePath, await pristineSlide.async('string'));
    }

    const pristineRels = pristineZip.file(relPath);
    if (pristineRels) {
      let relXml = await pristineRels.async('string');
      relXml = relXml.replace(/<Relationship\b[^>]*(?:notesSlide|comments|threadedComment)[^>]*\/>/g, '');
      zip.file(relPath, relXml);
    }
  }
}

async function sanitizePresentationPackage(zip: JSZip) {
  await removePowerPointAuxiliaryParts(zip);
  await removeChartEmbeddedWorkbookLinks(zip);
  await sanitizeXmlParts(zip);
  const slidePathSet = new Set(Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)));

  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (relsFile) {
    let relsXml = await relsFile.async('string');
    relsXml = relsXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      if (type.endsWith('/slide')) {
        return slidePathSet.has(`ppt/${target}`) ? tag : '';
      }
      return relationshipTargetsExistingPart(zip, 'ppt/_rels/presentation.xml.rels', target, targetMode) ? tag : '';
    });
    zip.file('ppt/_rels/presentation.xml.rels', relsXml);
  }

  const validSlideRelIds = new Set<string>();
  const relsFileAfter = zip.file('ppt/_rels/presentation.xml.rels');
  if (relsFileAfter) {
    const relsXml = await relsFileAfter.async('string');
    for (const tag of relsXml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const relId = tag.match(/\bId="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      if (type.endsWith('/slide') && relId && slidePathSet.has(`ppt/${target}`)) validSlideRelIds.add(relId);
    }
  }

  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    let presXml = await presFile.async('string');
    const seenSlideIds = new Set<string>();
    presXml = presXml.replace(/<p:sldId\b[^>]*\/>/g, (tag) => {
      const relId = tag.match(/\br:id="([^"]+)"/)?.[1] ?? '';
      const slideId = tag.match(/\bid="([^"]+)"/)?.[1] ?? '';
      if (!relId || !validSlideRelIds.has(relId) || seenSlideIds.has(slideId)) return '';
      seenSlideIds.add(slideId);
      return tag;
    });
    presXml = presXml
      .replace(/<p:sectionLst>[\s\S]*?<\/p:sectionLst>/g, '')
      .replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/g, '')
      .replace(/<p:photoAlbum>[\s\S]*?<\/p:photoAlbum>/g, '');
    zip.file('ppt/presentation.xml', presXml);
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ctXml = await ctFile.async('string');
    const seen = new Set<string>();
    ctXml = ctXml.replace(/<Override\b[^>]*\/>/g, (tag) => {
      const partName = tag.match(/\bPartName="([^"]+)"/)?.[1] ?? '';
      const contentType = tag.match(/\bContentType="([^"]+)"/)?.[1] ?? '';
      if (contentType === 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml') {
        const zipPath = partName.replace(/^\//, '');
        if (!slidePathSet.has(zipPath) || seen.has(partName)) return '';
        seen.add(partName);
      }
      return tag;
    });
    zip.file('[Content_Types].xml', ctXml);
  }

  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      if (/(notesSlide|comments|threadedComment)/.test(type)) return '';
      return relationshipTargetsExistingPart(zip, name, target, targetMode) ? tag : '';
    });
    zip.file(name, relXml);
  }

  // PowerPoint'teki "Onar" uyarısının önemli nedeni, silinen slaytlardan kalan
  // notesSlide/comment ilişkileridir. Template'ten sayfa kaldırınca not sayfaları ve
  // rel dosyaları pakette orphan kalabiliyor; Office bunu bozuk paket olarak algılıyor.
  const referencedNoteSlides = new Set<string>();
  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    const relXml = await file.async('string');
    for (const tag of relXml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      if (type.endsWith('/notesSlide') && targetMode !== 'External') {
        referencedNoteSlides.add(resolveRelationshipTarget(name, target));
      }
    }
  }

  for (const notePath of Object.keys(zip.files).filter((item) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(item))) {
    if (!referencedNoteSlides.has(notePath)) {
      zip.remove(notePath);
      zip.remove(notePath.replace('ppt/notesSlides/', 'ppt/notesSlides/_rels/') + '.rels');
    }
  }

  // Son temizlik: pakette kalan tüm .rels dosyalarında hedefi olmayan ilişkiyi,
  // Content_Types içinde de dosyası silinmiş Override kayıtlarını kaldır.
  for (const name of Object.keys(zip.files).filter((item) => item.endsWith('.rels'))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      return relationshipTargetsExistingPart(zip, name, target, targetMode) ? tag : '';
    });
    zip.file(name, relXml);
  }

  const finalCtFile = zip.file('[Content_Types].xml');
  if (finalCtFile) {
    let ctXml = await finalCtFile.async('string');
    ctXml = ctXml.replace(/<Override\b[^>]*\/>/g, (tag) => {
      const partName = tag.match(/\bPartName="([^"]+)"/)?.[1] ?? '';
      if (!partName) return tag;
      return zip.file(partName.replace(/^\//, '')) ? tag : '';
    });
    zip.file('[Content_Types].xml', ctXml);
  }

  await updateExtendedProperties(zip);
  await sanitizeXmlParts(zip);
}

async function rewriteBulletParagraphs(zip: JSZip, slideNo: number, lines: string[]) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  const xml = await file.async('string');
  const bodyShapeMatch = xml.match(/<p:sp>[\s\S]*?<p:cNvPr[^>]*name="TextBox 13"[\s\S]*?<\/p:sp>/);
  const altBodyShapeMatch = xml.match(/<p:sp>[\s\S]*?<p:cNvPr[^>]*name="矩形: 圆角 47"[\s\S]*?<\/p:sp>/);
  const shapeXml = slideNo === 2 ? bodyShapeMatch?.[0] : altBodyShapeMatch?.[0];
  if (!shapeXml) return;

  const paragraphMatches = Array.from(shapeXml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g));
  if (!paragraphMatches.length) return;

  const paragraphTexts = lines.map((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return { head: line, tail: '' };
    return { head: line.slice(0, idx + 1), tail: line.slice(idx + 1).trimStart() };
  });

  let localCursor = 0;
  const rebuiltShape: string[] = [];
  let lastIndex = 0;
  for (const match of paragraphMatches) {
    const pXml = match[0];
    const startIdx = match.index ?? 0;
    rebuiltShape.push(shapeXml.slice(lastIndex, startIdx));

    const runMatches = Array.from(pXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g));
    if (!runMatches.length) {
      rebuiltShape.push(pXml);
      lastIndex = startIdx + pXml.length;
      continue;
    }

    const nextLine = paragraphTexts[localCursor];
    localCursor += 1;
    const headText = nextLine?.head ?? '';
    const tailText = nextLine?.tail ?? '';

    let rebuiltParagraph = '';
    let runCursor = 0;
    let runLast = 0;
    for (const runMatch of runMatches) {
      const runStart = runMatch.index ?? 0;
      rebuiltParagraph += pXml.slice(runLast, runStart);
      let nextText = '';
      if (runCursor === 0) nextText = headText;
      else if (runCursor === 1) nextText = tailText ? ` ${tailText}` : '';
      rebuiltParagraph += `<a:t>${escapeXml(nextText)}</a:t>`;
      runLast = runStart + runMatch[0].length;
      runCursor += 1;
    }
    rebuiltParagraph += pXml.slice(runLast);
    rebuiltShape.push(rebuiltParagraph);
    lastIndex = startIdx + pXml.length;
  }
  rebuiltShape.push(shapeXml.slice(lastIndex));
  zip.file(fileName, xml.replace(shapeXml, rebuiltShape.join('')));
}

async function upsertCountCircle(
  zip: JSZip,
  slideNo: number,
  count: number,
  geom: { x: number; y: number; cx: number; cy: number },
  options?: { name?: string; fill?: string; fontSize?: number },
) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  const text = String(count);
  const shapeName = options?.name || 'WeeklyCountCircle';
  const fill = options?.fill || '92D050';
  const fontSize = options?.fontSize || 1800;
  const safeShapeName = escapeRegExp(shapeName);
  const shapeNameRe = new RegExp(`name="${safeShapeName}"`);
  if (shapeNameRe.test(xml)) {
    xml = xml.replace(new RegExp(`(<p:cNvPr id="\\d+" name="${safeShapeName}"[\\s\\S]*?<a:t>)([\\s\\S]*?)(<\\/a:t>[\\s\\S]*?<\\/p:sp>)`), `$1${escapeXml(text)}$3`);
    zip.file(fileName, xml);
    return;
  }
  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  const nextId = (ids.length ? Math.max(...ids) : 20) + 1;
  const badge = `<p:sp><p:nvSpPr><p:cNvPr id="${nextId}" name="${escapeXml(shapeName)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${geom.x}" y="${geom.y}"/><a:ext cx="${geom.cx}" cy="${geom.cy}"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="tr-TR" sz="${fontSize}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="tr-TR" sz="${fontSize}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:endParaRPr></a:p></p:txBody></p:sp>`;
  xml = xml.replace('</p:spTree>', `${badge}</p:spTree>`);
  zip.file(fileName, xml);
}

function buildSlideReplacements(payload: WeeklyManagementPresentationPayload, mode: 'management' | 'seller' = 'management') {
  const customerMap = buildCustomerMap(payload.customers);
  const highlightPageLines = buildWeeklyHighlightPageLines(payload, customerMap);
  const highlightPages = highlightPageLines.map((pageItems) => joinBulletLines(pageItems));
  const highlightPageCounts = buildWeeklyHighlightPageCounts(payload, customerMap);
  const toshibaPages = buildSegmentActivityPages(payload, 'Toshiba', customerMap, 2100);
  const nebimPages = buildSegmentActivityPages(payload, 'Nebim', customerMap, 2100);
  const otherPages = buildSegmentActivityPages(payload, 'Encore / EnPOS / Logo / Dynamics', customerMap, 2100);
  const completedRows = payload.topCompletedAccounts.slice(0, 10);
  const activeRows = payload.topActiveAccounts.slice(0, 10);
  const completedPhaseFirmCount = phaseGroupChartData(
    payload.completedPhaseChartAccounts ?? payload.completedPhaseAccounts ?? payload.topCompletedAccounts ?? [],
  ).reduce((total, item) => total + toNumber(item.value), 0);
  const activePhaseFirmCount = phaseGroupChartData(
    payload.activePhaseChartAccounts ?? payload.activePhaseAccounts ?? payload.topActiveAccounts ?? [],
  ).reduce((total, item) => total + toNumber(item.value), 0);

  const slide1: Record<number, string> = {
    3: formatDateRangeDots(payload.filters.from, payload.filters.to),
  };

  const slide2: Record<number, string> = { 0: 'İlerlemeler, İlk Temaslar ve Tamamlananlar' };
  for (let i = 1; i <= 30; i += 1) slide2[i] = '';

  const slide3: Record<number, string> = { 29: 'İlerlemeler, İlk Temaslar ve Tamamlananlar' };

  const slide4: Record<number, string> = {
    0: 'Retail Genel Durum Raporu',
    1: formatMonthLabel(payload.filters.from),
    2: formatNumber(payload.summary.totalAccounts),
    5: formatNumber(payload.summary.totalPosDevices),
    8: formatNumber(payload.summary.activeProjects),
    11: formatNumber(payload.summary.pipelinePosDevices),
  };

  const slide5: Record<number, string> = {
    0: `Fazı Tamamlanan Müşteriler — ${formatNumber(completedPhaseFirmCount)} Firma`,
    1: `Toplam ${formatNumber(completedPhaseFirmCount)} Firma — faz grubu bazında tamamlanan hesaplar`,
    2: 'Faz Grubu Bazında Tamamlanan Firma Sayısı',
    3: '',
    6: 'Tamamlanan En Son Faz / Açıklaması',
    31: `Toplam tamamlanan: ${formatNumber(completedPhaseFirmCount)} Firma`,
  };
  completedRows.forEach((row, idx) => {
    const base = 7 + idx * 3;
    slide5[base] = row?.customer || '-';
    slide5[base + 1] = row ? formatNumber(toNumber(row.pos_count)) : '-';
    slide5[base + 2] = row ? phaseGroupDisplay(row) : '-';
  });

  const slide6: Record<number, string> = {
    0: `Fazı Devam Eden Müşteriler — ${formatNumber(activePhaseFirmCount)} Firma`,
    1: '',
    2: `${formatNumber(activePhaseFirmCount)} firma`,
    3: 'Faz Grubu Bazında Aktif Firma Sayısı',
    4: '',
    7: 'Devam Eden En Son Faz / Açıklaması',
    32: `Toplam devam eden pipeline: ${formatNumber(payload.summary.pipelinePosDevices)} POS cihazı`,
  };
  activeRows.forEach((row, idx) => {
    const base = 8 + idx * 3;
    slide6[base] = row?.customer || '-';
    slide6[base + 1] = row ? formatNumber(toNumber(row.pos_count)) : '-';
    slide6[base + 2] = row ? phaseGroupDisplay(row) : '-';
  });

  const slidesLongText: Record<number, string> = {
    7: '',
    8: '',
    9: toshibaPages[0] || 'Toshiba segmentinde kayıt bulunmuyor.',
    10: nebimPages[0] || 'Nebim segmentinde kayıt bulunmuyor.',
    11: nebimPages[1] || 'Nebim segmentinde kayıt bulunmuyor.',
    12: nebimPages[2] || 'Nebim segmentinde kayıt bulunmuyor.',
    13: otherPages[0] || 'Kayıt bulunmuyor.',
    // Pazartesi Toplantısı Kararları ve Kasa Pos Entegrasyon Durumları
    // template'te statik kalmalı; bu slidelara text replacement uygulanmayacak.
    16: '',
  };

  const simpleSlideMaps: Record<number, Record<number, string>> = {};
  for (const [slideStr, text] of Object.entries(slidesLongText)) {
    const slideNo = Number(slideStr);
    simpleSlideMaps[slideNo] = {};
    const firstBodyIndex = slideNo === 7 ? 0 : slideNo === 8 ? 3 : slideNo === 9 ? 4 : slideNo === 10 ? 2 : slideNo === 11 ? 3 : slideNo === 12 ? 2 : slideNo === 13 ? 5 : slideNo === 14 ? 5 : slideNo === 16 ? 14 : 0;
    const maxIndex = slideNo === 7 ? 22 : slideNo === 8 ? 30 : slideNo === 9 ? 40 : slideNo === 10 ? 40 : slideNo === 11 ? 102 : slideNo === 12 ? 23 : slideNo === 13 ? 38 : slideNo === 14 ? 59 : slideNo === 16 ? 169 : firstBodyIndex;
    for (let i = firstBodyIndex; i <= maxIndex; i += 1) simpleSlideMaps[slideNo][i] = i === firstBodyIndex ? text : '';
  }
  simpleSlideMaps[7][23] = 'Ticari Riskler ve Yönetim Kararı Gerektiren Konular';
  simpleSlideMaps[8][0] = 'Dağıtım Kanalı ve Zincir Noktaları Genel Durum Raporu';
  // Bu sayfa sadece başlık ve tablo olmalı; template'teki eski açıklama/metin katmanlarını temizle.
  for (let i = 1; i <= 80; i += 1) simpleSlideMaps[8][i] = '';
  simpleSlideMaps[9][0] = 'Toshiba Kullanan Firmaların Genel Durum Raporu';
  simpleSlideMaps[10][0] = 'Nebim Kullanan Firmaların Genel Durum Raporu';
  simpleSlideMaps[10][1] = 'Sipariş / Yaygınlaştırma Aşaması';
  simpleSlideMaps[11][0] = 'Nebim Kullanan Firmaların Genel Durum Raporu';
  simpleSlideMaps[11][1] = 'Değerlendirmede';
  simpleSlideMaps[12][0] = 'Nebim Kullanan Firmaların Genel Durum Raporu';
  simpleSlideMaps[12][1] = 'Değerlendirmede';
  simpleSlideMaps[13][0] = 'Encore – EnPOS - Logo - Microsoft Dynamics vb. Kullanan Firmalardaki Durumlar';
  for (let i = 1; i <= 80; i += 1) simpleSlideMaps[13][i] = '';
  // Kasa Pos Entegrasyon Durumları slaytı şablondan geldiği gibi bırakılır.
  // Pazartesi Toplantısı Kararları - Takip Panosu export akışından kaldırılır.
  simpleSlideMaps[16][0] = '';
  simpleSlideMaps[16][2] = '';
  simpleSlideMaps[16][3] = '';
  simpleSlideMaps[16][4] = '';
  simpleSlideMaps[16][5] = '';
  simpleSlideMaps[16][6] = '';

  const slide17: Record<number, string> = {};
  const totals = payload.contactReport.totals;
  const showSummaryTargets = true;
  slide17[6] = `Yönetici Raporu Özeti – Ortak (${payload.contactReport.owners.length} Kişi)`;
  slide17[7] = `Periyot: ${formatDateRangeDots(payload.filters.from, payload.filters.to)}    Rapor Tarihi: ${formatDateDots(payload.filters.to)}`;
  slide17[8] = 'Satış Fiziki';
  slide17[9] = 'Satış Online';
  slide17[10] = 'Satış Telefon';
  slide17[11] = 'Satış E-posta';
  slide17[12] = 'Teknik Fiziki';
  slide17[13] = formatActualTarget(totals.salesPhysical, showSummaryTargets ? totals.targets?.salesPhysical : undefined);
  slide17[14] = formatActualTarget(totals.salesOnline, showSummaryTargets ? totals.targets?.salesOnline : undefined);
  slide17[15] = formatActualTarget(totals.salesPhone, showSummaryTargets ? totals.targets?.salesPhone : undefined);
  slide17[16] = formatActualTarget(totals.totalActivities, showSummaryTargets ? totals.targets?.totalActivities : undefined);
  slide17[17] = formatActualTarget(totals.uniqueCustomers, showSummaryTargets ? totals.targets?.uniqueCustomers : undefined);
  slide17[20] = 'Satış Fiziki';
  slide17[21] = 'Satış Online';
  slide17[22] = 'Satış Telefon';
  slide17[23] = 'Satış E-posta';
  slide17[24] = 'Teknik Fiziki';
  slide17[25] = 'Teknik Online';
  slide17[26] = 'Toplam Aktivite';
  slide17[27] = 'Tekil Firma';
  slide17[30] = 'Teknik Online';
  const owners = payload.contactReport.owners.slice(0, 4);
  const ownerStart = 31;
  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    const owner = owners[rowIndex];
    const base = ownerStart + rowIndex * 8;
    slide17[base] = owner?.owner || '-';
    slide17[base + 1] = owner ? String(owner.salesPhysical) : '0';
    slide17[base + 2] = owner ? String(owner.salesOnline) : '0';
    slide17[base + 3] = owner ? String(owner.salesPhone) : '0';
    slide17[base + 4] = owner ? String(owner.salesEmail) : '0';
    slide17[base + 5] = owner ? String(owner.technicalPhysical) : '0';
    slide17[base + 6] = owner ? String(owner.technicalOnline) : '0';
    slide17[base + 7] = owner ? String(owner.totalActivities) : '0';
  }
  slide17[63] = 'Toplam';
  slide17[64] = formatActualTarget(totals.salesPhysical, showSummaryTargets ? totals.targets?.salesPhysical : undefined);
  slide17[65] = formatActualTarget(totals.salesOnline, showSummaryTargets ? totals.targets?.salesOnline : undefined);
  slide17[66] = formatActualTarget(totals.salesPhone, showSummaryTargets ? totals.targets?.salesPhone : undefined);
  slide17[67] = formatActualTarget(totals.salesEmail, showSummaryTargets ? totals.targets?.salesEmail : undefined);
  slide17[68] = formatActualTarget(totals.technicalPhysical, showSummaryTargets ? totals.targets?.technicalPhysical : undefined);
  slide17[69] = formatActualTarget(totals.technicalOnline, showSummaryTargets ? totals.targets?.technicalOnline : undefined);
  slide17[70] = formatActualTarget(totals.totalActivities, showSummaryTargets ? totals.targets?.totalActivities : undefined);
  slide17[71] = formatActualTarget(totals.uniqueCustomers, showSummaryTargets ? totals.targets?.uniqueCustomers : undefined);

  return {
    1: slide1,
    2: slide2,
    3: slide3,
    4: slide4,
    5: slide5,
    6: slide6,
    7: simpleSlideMaps[7],
    8: simpleSlideMaps[8],
    9: simpleSlideMaps[9],
    10: simpleSlideMaps[10],
    11: simpleSlideMaps[11],
    12: simpleSlideMaps[12],
    13: simpleSlideMaps[13],
    16: simpleSlideMaps[16],
    17: slide17,
  } as Record<number, Record<number, string>>;
}


function xmlTextRun(text: string, fontSize = 1100, bold = false, color = '1F2937') {
  return `<a:r><a:rPr lang="tr-TR" sz="${fontSize}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/><a:cs typeface="Aptos"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>`;
}

function makeTextBox(
  id: number,
  name: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  text: string,
  options?: { fontSize?: number; bold?: boolean; color?: string; align?: 'l' | 'ctr' | 'r'; fill?: string; line?: string; marginLeft?: number; marginRight?: number },
) {
  const fontSize = options?.fontSize ?? 1100;
  const color = options?.color ?? '1F2937';
  const fill = options?.fill ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>` : '<a:noFill/>';
  const line = options?.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${options.line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${options?.marginLeft ?? 60000}" rIns="${options?.marginRight ?? 60000}" tIns="20000" bIns="20000" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="${options?.align ?? 'l'}"/>${xmlTextRun(text, fontSize, options?.bold, color)}<a:endParaRPr lang="tr-TR" sz="${fontSize}"/></a:p></p:txBody></p:sp>`;
}

function makeMetricCard(
  id: number,
  name: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  label: string,
  value: string,
  options?: {
    labelFontSize?: number;
    valueFontSize?: number;
    fill?: string;
    line?: string;
    labelColor?: string;
    valueColor?: string;
  },
) {
  const labelFontSize = options?.labelFontSize ?? 820;
  const valueFontSize = options?.valueFontSize ?? 1180;
  const fill = options?.fill ?? 'F4F8FD';
  const line = options?.line ?? 'BFD4F2';
  const labelColor = options?.labelColor ?? '5B6B82';
  const valueColor = options?.valueColor ?? '17365D';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="30000" rIns="30000" tIns="22000" bIns="16000" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="tr-TR" sz="${labelFontSize}" b="1"><a:solidFill><a:srgbClr val="${labelColor}"/></a:solidFill><a:latin typeface="Aptos"/><a:cs typeface="Aptos"/></a:rPr><a:t>${escapeXml(label)}</a:t></a:r><a:endParaRPr lang="tr-TR" sz="${labelFontSize}"/></a:p><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="tr-TR" sz="${valueFontSize}" b="1"><a:solidFill><a:srgbClr val="${valueColor}"/></a:solidFill><a:latin typeface="Aptos"/><a:cs typeface="Aptos"/></a:rPr><a:t>${escapeXml(value)}</a:t></a:r><a:endParaRPr lang="tr-TR" sz="${valueFontSize}"/></a:p></p:txBody></p:sp>`;
}


function paginateRetailSupportRows(rows: any[], rowsPerPage = 14) {
  const pages: any[][] = [];
  for (let index = 0; index < rows.length; index += rowsPerPage) {
    pages.push(rows.slice(index, index + rowsPerPage));
  }
  return pages.length ? pages : [[]];
}

async function injectRetailSupportTicketSummarySlide(
  zip: JSZip,
  slideNo: number,
  payload: WeeklyManagementPresentationPayload,
  pageRows?: any[],
  pageIndex = 0,
  pageCount = 1,
) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = removeSlideShapesByName(xml, [/^GeneratedJiraTicketSummary/, 'Metin kutusu 3', 'Tablo 2']);

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 420) + 1;
  const summary = payload.jiraTicketSummary;
  const allRows = summary?.rows ?? [];
  const rows = pageRows ?? paginateRetailSupportRows(allRows)[0] ?? [];

  // Retail Support slaydında template içeriği kaldırılır; yalnızca master/footer dekoru korunur.
  // Veri hesaplama burada değiştirilmez; bu bölüm yalnızca Retail Support slaytını okunur yerleşime taşır.
  const slideW = 12192000;
  const slideH = 6858000;
  const left = 430000;
  const hasWarning = Boolean(summary?.warning);
  const top = hasWarning ? 1220000 : 1060000;
  const tableW = slideW - left * 2;
  const headerH = 330000;
  const rowH = 300000;
  const totalH = 340000;
  const fontSize = 900;
  const widths = [2100000, 1550000, 1550000, 1550000, 2380000, 2020000];
  const headers = ['Firma', 'Oluşturulan', 'Kapatılmış', 'Devam Eden', 'Geliştirme Bekl.', 'Müşteri Bekl.'];
  const parts: string[] = [];

  const title = `Retail Support Ekibi Ticket Özeti - ${formatDateDots(payload.filters.from)} – ${formatDateDots(payload.filters.to)}${pageCount > 1 ? ` (${pageIndex + 1}/${pageCount})` : ''}`;
  const titleFontSize = title.length > 56 ? 2240 : 2520;
  parts.push(makeTextBox(
    nextId++,
    'GeneratedJiraTicketSummaryTitle',
    360000,
    250000,
    11200000,
    360000,
    title,
    { fontSize: titleFontSize, bold: true, color: '1B4F9C', align: 'l', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 0, marginRight: 0 },
  ));
  parts.push(makeTextBox(nextId++, 'GeneratedJiraTicketSummaryTitleAccent', 360000, 560000, 3000000, 24000, '', { fontSize: 1, color: '2F75B5', fill: '2F75B5', line: '2F75B5', marginLeft: 0, marginRight: 0 }));

  // KPI kartları diğer genel durum raporlarıyla hizalı şekilde kompakt tutulur.
  const metricTop = 660000;
  const metricW = 1986000;
  const metricGap = 65000;
  const metrics: Array<[string, string]> = [
    ['Oluşturulan', formatNumber(summary?.totalCreated ?? 0)],
    ['Kapatılmış', formatNumber(summary?.totalClosed ?? 0)],
    ['Devam Eden', formatNumber(summary?.totalOngoing ?? 0)],
    ['Geliştirme Bekl.', formatNumber(summary?.totalDevelopmentWaiting ?? 0)],
    ['Müşteri Bekl.', formatNumber(summary?.totalCustomerWaiting ?? 0)],
  ];
  metrics.forEach(([label, value], index) => {
    parts.push(makeMetricCard(
      nextId++,
      `GeneratedJiraTicketSummaryMetric_${index}`,
      left + index * (metricW + metricGap),
      metricTop,
      metricW,
      360000,
      label,
      value,
      { labelFontSize: 760, valueFontSize: 1180, fill: 'F4F8FD', line: '9FC5F8' },
    ));
  });

  if (summary?.warning) {
    parts.push(makeTextBox(nextId++, 'GeneratedJiraTicketSummaryWarning', left, 1050000, tableW, 150000, truncate(summary.warning, 160), { fontSize: 680, color: 'B45309', align: 'ctr', fill: 'FFF7ED', line: 'FDBA74' }));
  }

  let x = left;
  headers.forEach((header, idx) => {
    parts.push(makeTextBox(nextId++, `GeneratedJiraTicketSummaryHeader_${idx}`, x, top, widths[idx], headerH, header, { fontSize: idx === 0 ? 900 : 880, bold: true, color: 'FFFFFF', align: idx === 0 ? 'l' : 'ctr', fill: '2F75B5', line: 'FFFFFF', marginLeft: 42000, marginRight: 26000 }));
    x += widths[idx];
  });

  rows.forEach((row, rowIndex) => {
    const y = top + headerH + rowIndex * rowH;
    const values = [
      row.company,
      String(row.created ?? 0),
      String(row.closed ?? 0),
      String(row.ongoing ?? 0),
      String(row.developmentWaiting ?? 0),
      String(row.customerWaiting ?? 0),
    ];
    let cellX = left;
    values.forEach((value, idx) => {
      parts.push(makeTextBox(nextId++, `GeneratedJiraTicketSummaryCell_${rowIndex}_${idx}`, cellX, y, widths[idx], rowH, truncate(value || '-', idx === 0 ? 28 : 8), { fontSize: idx === 0 ? 920 : fontSize, color: idx === 0 ? '0F172A' : '17365D', align: idx === 0 ? 'l' : 'ctr', fill: rowIndex % 2 === 0 ? 'E6F1FA' : 'D2E7F5', line: 'FFFFFF', marginLeft: 42000, marginRight: 26000 }));
      cellX += widths[idx];
    });
  });

  const totalsY = top + headerH + rows.length * rowH;
  if (rows.length) {
    const totals = [
      'GENEL TOPLAM',
      String(summary?.totalCreated ?? 0),
      String(summary?.totalClosed ?? 0),
      String(summary?.totalOngoing ?? 0),
      String(summary?.totalDevelopmentWaiting ?? 0),
      String(summary?.totalCustomerWaiting ?? 0),
    ];
    let cellX = left;
    totals.forEach((value, idx) => {
      parts.push(makeTextBox(nextId++, `GeneratedJiraTicketSummaryTotal_${idx}`, cellX, totalsY, widths[idx], totalH, value, { fontSize: idx === 0 ? 940 : 960, bold: true, color: '0F172A', align: idx === 0 ? 'l' : 'ctr', fill: '9CC2E5', line: 'FFFFFF', marginLeft: 42000, marginRight: 26000 }));
      cellX += widths[idx];
    });
  }

  if (!rows.length) {
    const message = summary?.warning
      ? 'Jira bağlantısı tamamlanınca haftalık ticket özeti burada görünecek.'
      : 'Seçili haftada Jira ticket kaydı bulunmuyor. JQL tarih aralığı ve firma alanı kontrol edilmeli.';
    parts.push(makeTextBox(nextId++, 'GeneratedJiraTicketSummaryEmpty', left, top + headerH, tableW, rowH * 2, message, { fontSize: 900, color: '475569', align: 'ctr', fill: 'F8FAFC', line: '94A3B8' }));
  }

  if (pageCount > 1) {
    parts.push(makeTextBox(nextId++, 'GeneratedJiraTicketSummaryPageNote', left, 5980000, tableW, 150000, `Firma listesi okunabilirlik için ${pageCount} sayfaya bölündü. Bu sayfa: ${pageIndex + 1}/${pageCount}`, { fontSize: 620, color: '475569', align: 'ctr', fill: 'FFFFFF', line: 'FFFFFF' }));
  }

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}

async function injectRetailSupportTicketSummarySlides(zip: JSZip, slideNo: number, payload: WeeklyManagementPresentationPayload) {
  const allRows = payload.jiraTicketSummary?.rows ?? [];
  const pages = paginateRetailSupportRows(allRows, 14);
  let currentSlideNo = slideNo;
  const slideNos = [currentSlideNo];
  await injectRetailSupportTicketSummarySlide(zip, currentSlideNo, payload, pages[0] ?? [], 0, pages.length);
  for (let pageIndex = 1; pageIndex < pages.length; pageIndex += 1) {
    const duplicatedSlideNo = await duplicateSlideAfter(zip, currentSlideNo);
    if (!duplicatedSlideNo) break;
    currentSlideNo = duplicatedSlideNo;
    slideNos.push(currentSlideNo);
    await injectRetailSupportTicketSummarySlide(zip, currentSlideNo, payload, pages[pageIndex] ?? [], pageIndex, pages.length);
  }
  return slideNos;
}

async function injectCustomerCountPill(zip: JSZip, slideNo: number, count: number) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedCustomerCountPill[\s\S]*?<\/p:sp>/g, '');

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 250) + 1;
  const label = `${formatNumber(count)} Müşteri`;
  const parts = [
    makeTextBox(
      nextId++,
      `GeneratedCustomerCountPill_${slideNo}`,
      10160000,
      620000,
      1450000,
      430000,
      label,
      {
        fontSize: 980,
        bold: true,
        color: '17365D',
        align: 'ctr',
        fill: 'F4F8FD',
        line: 'BFD4F2',
        marginLeft: 30000,
        marginRight: 30000,
      },
    ),
  ];
  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}

function sum(values: number[]) {
  return values.reduce((total, item) => total + item, 0);
}


async function injectSegmentReportHeader(zip: JSZip, slideNo: number, title: string, summary: SegmentReportSummary) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedSegmentReportHeader[\s\S]*?<\/p:sp>/g, '');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedCustomerCountPill[\s\S]*?<\/p:sp>/g, '');

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 260) + 1;
  const slideW = 12192000;
  const titleFontSize = title.length > 56 ? 2240 : 2520;
  const cardLeft = 430000;
  const cardTop = 660000;
  const cardH = 360000;
  const gap = 65000;
  const tableW = slideW - cardLeft * 2;
  const cardW = Math.floor((tableW - gap * 4) / 5);
  const cards = [
    { label: 'Toplam POS Adedi', value: formatNumber(summary.totalPos) },
    { label: 'Müşteri Sayısı', value: formatNumber(summary.customerCount) },
    { label: 'Tamamlanan Faz', value: formatNumber(summary.completedPhaseCount) },
    { label: 'Devam Eden Faz', value: formatNumber(summary.activePhaseCount) },
    { label: 'Teklifte Cihaz / Adet', value: truncate(summary.quoteDeviceText, 74), labelFontSize: 780, valueFontSize: summary.quoteDeviceText.length > 32 ? 860 : 1180 },
  ];

  const parts = [
    makeTextBox(
      nextId++,
      `GeneratedSegmentReportHeaderCanvas_${slideNo}`,
      0,
      0,
      slideW,
      1080000,
      '',
      { fontSize: 1, color: 'FFFFFF', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 0, marginRight: 0 },
    ),
    makeTextBox(
      nextId++,
      `GeneratedSegmentReportHeaderTitle_${slideNo}`,
      360000,
      250000,
      11200000,
      360000,
      title,
      { fontSize: titleFontSize, bold: true, color: '1F9FE5', align: 'l', marginLeft: 0, marginRight: 0 },
    ),
    ...cards.map((card, index) => makeMetricCard(
      nextId++,
      `GeneratedSegmentReportHeaderMetric_${slideNo}_${index}`,
      cardLeft + index * (cardW + gap),
      cardTop,
      cardW,
      cardH,
      card.label,
      card.value,
      { labelFontSize: (card as any).labelFontSize ?? 860, valueFontSize: card.valueFontSize ?? 1320 },
    )),
  ];
  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}


async function injectWeeklyProgressSlide(
  zip: JSZip,
  slideNo: number,
  pageEntries: WeeklyProgressEntry[],
  payload: WeeklyManagementPresentationPayload,
  pageIndex: number,
  pageCount: number,
  mode: 'normal' | 'businessPartner' = 'normal',
) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = removeSlideShapesByName(xml, [
    /^GeneratedWeeklyProgress/,
    /^WeeklyCountCircle/,
    'WeeklyCountCircle',
    /^Eksi İşareti/,
    /^Minus/,
    /^Graphique/,
    /^Grafik/,
    /^TextBox 13$/,
    /^矩形: 圆角 47$/,
  ]);

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 300) + 1;
  const slideW = 12192000;
  const left = 460000;
  const right = 460000;
  const contentW = slideW - left - right;
  const footerSafeY = 6500000;
  const parts: string[] = [];

  // Kullanıcının isteğine göre sağ üstte kalan ikonlar kaldırılır.
  // Ancak sayfanın üst kısmında, örnekteki gibi üç adet özet bilgi kartı gösterilir.
  void pageCount;

  const itemFilterMode = mode === 'businessPartner' ? 'only' : 'without';
  const uniqueFirmCount = buildWeeklyProgressUniqueFirms(payload, mode).length;
  const weeklyNewContacts = filterWeeklyBusinessPartnerItems(payload, payload.weeklyNewContacts ?? [], itemFilterMode);
  const weeklyPhaseChangedProgress = filterWeeklyBusinessPartnerItems(payload, payload.weeklyPhaseChangedProgress ?? [], itemFilterMode);
  const weeklyPhaseUnchangedProgress = filterWeeklyBusinessPartnerItems(payload, payload.weeklyPhaseUnchangedProgress ?? [], itemFilterMode);
  const weeklyTechnicalActivities = filterWeeklyBusinessPartnerItems(payload, (payload as any).weeklyTechnicalActivities ?? [], itemFilterMode);
  const summaryCards = [
    { label: 'İlk Temaslar', value: formatNumber(weeklyNewContacts.length) },
    { label: 'Faz Değişikliği Olan', value: formatNumber(weeklyPhaseChangedProgress.length) },
    { label: 'Faz Değişikliği Olmayan', value: formatNumber(weeklyPhaseUnchangedProgress.length) },
    { label: 'Teknik Aktiviteler', value: formatNumber(weeklyTechnicalActivities.length) },
    { label: 'Tekil Firma', value: formatNumber(uniqueFirmCount) },
  ];

  const tableLeft = left;
  const tableW = contentW;
  const widths = [760000, 1280000, 1880000, 1050000, 1120000, 1050000, tableW - 760000 - 1280000 - 1880000 - 1050000 - 1120000 - 1050000];
  const headers = ['Tarih', 'Firma', 'Faz No / Açıklaması', 'Faz Durumu', 'Aktivite Tipi', 'Ekleyen', 'Notları'];
  const headerH = 255000;
  const rowH = 278000;
  const sectionH = 285000;
  const sectionTopGap = 65000;
  const sectionGap = 145000;
  const rowFont = 860;
  const noteFont = 830;
  const palette = {
    sectionFill: 'EEF4FB',
    sectionLine: 'D7E6F7',
    sectionText: '17365D',
    headerFill: '1F5EAE',
    headerLine: 'D7E3F4',
    headerText: 'FFFFFF',
    rowFillA: 'FFFFFF',
    rowFillB: 'F7FAFD',
    cellLine: 'D7E3F4',
    emptyFill: 'F8FBFE',
    emptyText: '475569',
  };
  const cardGap = 90000;
  const cardTop = 760000;
  const cardH = 430000;
  const cardW = Math.floor((contentW - cardGap * (summaryCards.length - 1)) / summaryCards.length);
  summaryCards.forEach((card, idx) => {
    parts.push(makeMetricCard(
      nextId++,
      `GeneratedWeeklyProgressMetric_${slideNo}_${idx}`,
      left + idx * (cardW + cardGap),
      cardTop,
      cardW,
      cardH,
      card.label,
      card.value,
      {
        labelFontSize: 860,
        valueFontSize: 1380,
        fill: 'F7FAFD',
        line: 'BFD4F2',
        labelColor: '5B6B82',
        valueColor: '17365D',
      },
    ));
  });

  let y = 1260000;
  let openTable = false;
  let rowIndex = 0;

  const drawHeaders = (sectionKey: string) => {
    let x = tableLeft;
    headers.forEach((header, idx) => {
      parts.push(makeTextBox(nextId++, `GeneratedWeeklyProgressHeader_${slideNo}_${sectionKey}_${idx}`, x, y, widths[idx], headerH, header, {
        fontSize: 820,
        bold: true,
        color: palette.headerText,
        align: idx === 4 ? 'l' : 'ctr',
        fill: palette.headerFill,
        line: palette.headerLine,
        marginLeft: 17000,
        marginRight: 17000,
      }));
      x += widths[idx];
    });
    y += headerH;
    openTable = true;
    rowIndex = 0;
  };

  if (pageEntries[0]?.kind === 'row') {
    drawHeaders('continued_top');
  }

  pageEntries.forEach((entry, entryIndex) => {
    if (y > footerSafeY - 160000) return;
    if (entry.kind === 'heading') {
      openTable = false;
      if (entryIndex > 0) y += sectionTopGap;
      const sectionTitle = entry.title === 'Tekil Firmalar' ? `Tekil Firmalar — ${formatNumber(entry.count)} Firma` : entry.title;
      parts.push(makeTextBox(nextId++, `GeneratedWeeklyProgressSection_${slideNo}_${entryIndex}`, tableLeft, y, tableW, sectionH, sectionTitle, {
        fontSize: 1120,
        bold: true,
        color: palette.sectionText,
        align: 'ctr',
        fill: palette.sectionFill,
        line: palette.sectionLine,
        marginLeft: 25000,
        marginRight: 25000,
      }));
      y += sectionH + sectionGap;
      const next = pageEntries[entryIndex + 1];
      if (next && next.kind === 'row') drawHeaders(String(entryIndex));
      return;
    }

    if (entry.kind === 'empty') {
      if (openTable) openTable = false;
      parts.push(makeTextBox(nextId++, `GeneratedWeeklyProgressEmpty_${slideNo}_${entryIndex}`, tableLeft, y, tableW, rowH, entry.text, {
        fontSize: 940,
        color: palette.emptyText,
        align: 'ctr',
        fill: palette.emptyFill,
        line: palette.cellLine,
        marginLeft: 30000,
        marginRight: 30000,
      }));
      y += rowH + 70000;
      return;
    }

    if (!openTable) drawHeaders(`continued_${entryIndex}`);
    const item = entry.item;
    const values = [
      weeklyActivityDate(item.created_at),
      trimText(item.customer, '-'),
      weeklyActivityPhaseLabel(item),
      trimText((item as any).phase_status, '-'),
      trimText(item.activity_type, '-'),
      trimText(item.owner, '-'),
      trimText(item.note, '-'),
    ];
    let x = tableLeft;
    const fill = rowIndex % 2 === 0 ? palette.rowFillA : palette.rowFillB;
    values.forEach((value, idx) => {
      const limit = idx === 1 ? 18 : idx === 2 ? 32 : idx === 3 ? 18 : idx === 4 ? 18 : idx === 5 ? 18 : idx === 6 ? 72 : 12;
      parts.push(makeTextBox(nextId++, `GeneratedWeeklyProgressCell_${slideNo}_${entryIndex}_${idx}`, x, y, widths[idx], rowH, truncate(value || '-', limit), {
        fontSize: idx === 6 ? noteFont : rowFont,
        bold: idx === 1,
        color: idx === 1 ? palette.sectionText : '1F2937',
        align: idx === 0 ? 'ctr' : 'l',
        fill,
        line: palette.cellLine,
        marginLeft: 18000,
        marginRight: 18000,
      }));
      x += widths[idx];
    });
    y += rowH;
    rowIndex += 1;
  });

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}

function posBrandCountDisplay(row: { pos_markasi?: unknown; posBrand?: unknown; eft_pos_markasi?: unknown; pos_count?: unknown }) {
  const brand = trimText(row.pos_markasi ?? row.posBrand ?? row.eft_pos_markasi, 'Marka Yok');
  const count = formatNumber(toNumber(row.pos_count));
  return `${brand} / ${count}`;
}

async function injectTopAccountsTable(
  zip: JSZip,
  slideNo: number,
  rows: Array<{ customer?: string; pos_count?: unknown } & Record<string, unknown>>,
  totalText: string,
) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:cNvPr id="\d+" name="GeneratedTopAccountsTable(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, '');
  xml = xml.replace(/<p:graphicFrame>(?:(?!<\/p:graphicFrame>)[\s\S])*?<p:cNvPr id="\d+" name="GeneratedTopAccountsTable(?:(?!<\/p:graphicFrame>)[\s\S])*?<\/p:graphicFrame>/g, '');

  // 4 ve 5. sayfanın sağ tarafındaki şablon tablosu 8 satıra göre hazırlandığı için
  // 10 satır basınca arkada sol/sağ mavi çizgiler ve eski hücreler görünüyordu.
  // Sadece bu sayfalardaki eski sağ tablo/başlık/toplam katmanlarını kaldırıp yeni tabloyu
  // temiz bir alana basıyoruz; sol taraftaki grafik ve diğer şablon öğelerine dokunmuyoruz.
  if (slideNo === 5 || slideNo === 6) {
    xml = xml
      .replace(/<p:graphicFrame>(?:(?!<\/p:graphicFrame>)[\s\S])*?<p:cNvPr id="\d+" name="Table 0"(?:(?!<\/p:graphicFrame>)[\s\S])*?<\/p:graphicFrame>/g, '')
      .replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:cNvPr id="\d+" name="Text 3"(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, '')
      .replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:cNvPr id="\d+" name="Text 4"(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, '');
  }

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 300) + 1;

  const left = 6060000;
  // Tabloyu yukarı alıp toplam satırını logonun üstünde bitiriyoruz.
  // İçerik kısaltılmıyor; sadece okunabilir font + doğru yerleşim uygulanıyor.
  const top = 1580000;
  const tableW = 5720000;
  const headerH = 500000;
  const rowH = 365000;
  const totalH = 230000;
  // Sağ tablo 4 kolonda kalıyor; sadece alan/font dengesi yeniden ayarlandı.
  // Tarih kolonunu gerçek tarih genişliğine çıkarıyoruz, POS markası/adedi ve faz alanını da
  // okunabilir tutuyoruz. Kolon adı veya içerik kısaltması yapılmıyor.
  const widths = [1440000, 1560000, 1780000, tableW - 1440000 - 1560000 - 1780000];
  const phaseHeader = slideNo === 6 ? 'Devam Eden En Son Faz' : 'Tamamlanan En Son Faz';
  const headers = ['Firma', 'POS Markası / Adedi', phaseHeader, 'Tarih'];
  const fitted = rows.slice(0, 10);
  const parts: string[] = [];

  // Sağ taraftaki eski 8 satırlı şablon tablosunu kapatıp 10 satırlı tabloyu temiz şekilde basar.
  parts.push(makeTextBox(nextId++, `GeneratedTopAccountsTableCanvas_${slideNo}`, left - 70000, top - 70000, tableW + 140000, headerH + rowH * 10 + totalH + 120000, '', { fontSize: 1, color: 'FFFFFF', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 0, marginRight: 0 }));

  let x = left;
  headers.forEach((header, idx) => {
    parts.push(makeTextBox(nextId++, `GeneratedTopAccountsTableHeader_${slideNo}_${idx}`, x, top, widths[idx], headerH, header, { fontSize: 1050, bold: true, color: 'FFFFFF', align: idx === 0 ? 'l' : 'ctr', fill: '1F5EAE', line: 'D7E3F4', marginLeft: 30000, marginRight: 22000 }));
    x += widths[idx];
  });

  for (let rowIndex = 0; rowIndex < 10; rowIndex += 1) {
    const row = fitted[rowIndex];
    const fill = rowIndex % 2 === 0 ? 'EAF1FB' : 'FFFFFF';
    const cells = row
      ? [
        trimText(row.customer, '-'),
        posBrandCountDisplay(row as any),
        phaseDisplay((row as any).phase_no, (row as any).phase_name),
        latestActivityDateDisplay(row as any),
      ]
      : ['', '', '', ''];
    x = left;
    cells.forEach((cell, idx) => {
      const isPosBrand = idx === 1;
      const isPhase = idx === 2;
      const isDate = idx === 3;
      parts.push(makeTextBox(nextId++, `GeneratedTopAccountsTableCell_${slideNo}_${rowIndex}_${idx}`, x, top + headerH + rowIndex * rowH, widths[idx], rowH, cell, { fontSize: isPhase ? 1020 : isPosBrand ? 1080 : isDate ? 1020 : 1040, bold: isPosBrand, color: isPosBrand ? '0050B5' : '17365D', align: isPosBrand || isDate ? 'ctr' : 'l', fill, line: 'D7E3F4', marginLeft: 30000, marginRight: 22000 }));
      x += widths[idx];
    });
  }

  parts.push(makeTextBox(nextId++, `GeneratedTopAccountsTableTotal_${slideNo}`, left, top + headerH + rowH * 10, tableW, totalH, totalText, { fontSize: 1040, color: '46649B', align: 'ctr', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 40000, marginRight: 40000 }));

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}

async function injectSegmentTable(zip: JSZip, slideNo: number, rows: SegmentTableRow[], emptyMessage = 'Gösterilecek kayıt bulunmuyor.') {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedSegmentTable[\s\S]*?<\/p:sp>/g, '');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedDistributionTable[\s\S]*?<\/p:sp>/g, '');
  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 200) + 1;

  const slideW = 12192000;
  const slideH = 6858000;
  const left = 430000;
  const top = 1040000;
  const headerH = 350000;
  const rowH = 390000;
  const tableW = slideW - left * 2;
  const widths = [1600000, 2100000, 950000, 800000, 1050000, 750000, 750000, 1100000, 850000, tableW - 1600000 - 2100000 - 950000 - 800000 - 1050000 - 750000 - 750000 - 1100000 - 850000];
  const headers = ['Firma Adı', 'Faz No / Açıklaması', 'Faz Durumu', 'Tarih', 'Bilgisayar Markası', 'POS Modeli', 'Mağaza Sayısı', 'EFT-POS Markası', 'Toplam POS', 'Teklif Durumu'];
  const fitted = rows.slice(0, 11);
  const parts: string[] = [];

  // Şablondaki gövde yazı/çizgi/placeholder kalıntılarını kapat; alt sol dalga ve sağ alt PAX logosu görünür kalır.
  const footerSafeY = 5860000;
  parts.push(makeTextBox(nextId++, `GeneratedSegmentTableCanvas_${slideNo}`, 0, 960000, slideW, Math.max(0, footerSafeY - 960000), '', { fontSize: 1, color: 'FFFFFF', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 0, marginRight: 0 }));

  let x = left;
  headers.forEach((header, idx) => {
    parts.push(makeTextBox(nextId++, `GeneratedSegmentTableHeader_${slideNo}_${idx}`, x, top, widths[idx], headerH, header, { fontSize: idx === 1 ? 740 : idx === 4 ? 720 : 780, bold: true, color: 'FFFFFF', align: 'ctr', fill: '17365D', line: 'FFFFFF', marginLeft: 14000, marginRight: 14000 }));
    x += widths[idx];
  });

  fitted.forEach((row, rowIndex) => {
    const values = [row.company, row.phaseLabel, row.phaseStatus, row.activityDate, row.computer, row.posModel, row.storeCount, row.eftPosBrand, row.totalPos, row.quoteStatus];
    let cellX = left;
    const y = top + headerH + rowIndex * rowH;
    values.forEach((value, idx) => {
      const align = idx === 3 || idx === 5 || idx === 6 || idx === 8 ? 'ctr' : 'l';
      parts.push(makeTextBox(nextId++, `GeneratedSegmentTableCell_${slideNo}_${rowIndex}_${idx}`, cellX, y, widths[idx], rowH, truncate(value || '-', idx === 1 ? 68 : idx === 9 ? 30 : 28), { fontSize: idx === 1 ? 780 : 850, color: '1F2937', align, fill: rowIndex % 2 === 0 ? 'F8FAFC' : 'EEF4FB', line: 'D7E3F4', marginLeft: 14000, marginRight: 14000 }));
      cellX += widths[idx];
    });
  });

  if (!fitted.length) {
    parts.push(makeTextBox(nextId++, `GeneratedSegmentTableEmpty_${slideNo}`, left, top + headerH, sum(widths), rowH, emptyMessage, { fontSize: 950, color: '475569', align: 'ctr', fill: 'F8FAFC', line: 'D7E3F4' }));
  }

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}


function removeSlideTables(xml: string) {
  return xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g, (frame) => (frame.includes('<a:tbl') ? '' : frame));
}

async function clearKasaposIntegrationSlideCanvas(zip: JSZip, slideNo: number) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedKasaposIntegration[\s\S]*?<\/p:sp>/g, '');
  xml = removeSlideTables(xml);
  zip.file(fileName, xml);
}


async function injectContactReportSlide(zip: JSZip, slideNo: number, payload: WeeklyManagementPresentationPayload, mode: 'management' | 'seller' = 'management') {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');

  xml = xml.replace(/<p:graphicFrame>(?:(?!<\/p:graphicFrame>)[\s\S])*?<p:cNvPr id="\d+" name="Tablo 2"(?:(?!<\/p:graphicFrame>)[\s\S])*?<\/p:graphicFrame>/g, '');
  xml = xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:cNvPr id="\d+" name="GeneratedContactReport(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, '');

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 350) + 1;
  const totals = payload.contactReport.totals;
  const owners = payload.contactReport.owners.slice(0, 8);
  const slideW = 12192000;
  const left = 260000;
  const right = 260000;
  const contentW = slideW - left - right;
  const cardsTop = 930000;
  const cardH = 460000;
  const cardGap = 35000;
  const cardW = Math.floor((contentW - cardGap * 7) / 8);
  const sectionTop = 1550000;
  const sectionH = 300000;
  const tableTop = 1945000;
  const headerH = 330000;
  const rowH = 360000;
  const cardFill = 'F7FAFD';
  const cardLine = 'BFD4F2';
  const sectionFill = 'EEF4FB';
  const sectionLine = 'D7E3F4';
  const tableHeadFill = '2A66B2';
  const tableLine = 'D7E3F4';
  const parts: string[] = [];
  const showSummaryTargets = true;

  const summaryCards = [
    ['Satış Fiziki', formatActualTarget(totals.salesPhysical, showSummaryTargets ? totals.targets?.salesPhysical : undefined)],
    ['Satış Online', formatActualTarget(totals.salesOnline, showSummaryTargets ? totals.targets?.salesOnline : undefined)],
    ['Satış Telefon', formatActualTarget(totals.salesPhone, showSummaryTargets ? totals.targets?.salesPhone : undefined)],
    ['Satış E-posta', formatActualTarget(totals.salesEmail, showSummaryTargets ? totals.targets?.salesEmail : undefined)],
    ['Teknik Fiziki', formatActualTarget(totals.technicalPhysical, showSummaryTargets ? totals.targets?.technicalPhysical : undefined)],
    ['Teknik Online', formatActualTarget(totals.technicalOnline, showSummaryTargets ? totals.targets?.technicalOnline : undefined)],
    ['Toplam Aktivite', formatActualTarget(totals.totalActivities, showSummaryTargets ? totals.targets?.totalActivities : undefined)],
    ['Tekil Firma', formatActualTarget(totals.uniqueCustomers, showSummaryTargets ? totals.targets?.uniqueCustomers : undefined)],
  ];

  summaryCards.forEach(([label, value], idx) => {
    const x = left + idx * (cardW + cardGap);
    parts.push(makeMetricCard(
      nextId++,
      `GeneratedContactReportCard_${slideNo}_${idx}`,
      x,
      cardsTop,
      cardW,
      cardH,
      label,
      value,
      {
        labelFontSize: 710,
        valueFontSize: 1320,
        fill: cardFill,
        line: cardLine,
        labelColor: '5B6B82',
        valueColor: '17365D',
      },
    ));
  });

  parts.push(makeTextBox(nextId++, `GeneratedContactReportSection_${slideNo}`, left, sectionTop, contentW, sectionH, 'Temas Edilen Müşteriler — Kişi Bazlı Özet', {
    fontSize: 1120,
    bold: true,
    color: '17365D',
    align: 'ctr',
    fill: sectionFill,
    line: sectionLine,
    marginLeft: 26000,
    marginRight: 26000,
  }));

  const fixedWidths = [1540000, 1220000, 1220000, 1220000, 1220000, 1220000, 1220000, 1320000];
  const widths = [1540000, ...fixedWidths.slice(1), contentW - fixedWidths.reduce((sum, value) => sum + value, 0)];
  const headers = ['Sorumlu', 'Satış Fiziki', 'Satış Online', 'Satış Telefon', 'Satış E-posta', 'Teknik Fiziki', 'Teknik Online', 'Toplam Aktivite', 'Tekil Firma'];

  let x = left;
  headers.forEach((header, idx) => {
    parts.push(makeTextBox(nextId++, `GeneratedContactReportHeader_${slideNo}_${idx}`, x, tableTop, widths[idx], headerH, header, {
      fontSize: idx === 0 ? 780 : 690,
      bold: true,
      color: 'FFFFFF',
      align: 'ctr',
      fill: tableHeadFill,
      line: tableLine,
      marginLeft: 9000,
      marginRight: 9000,
    }));
    x += widths[idx];
  });

  const totalRow = {
    owner: 'Toplam',
    salesPhysical: totals.salesPhysical,
    salesOnline: totals.salesOnline,
    salesPhone: totals.salesPhone,
    salesEmail: totals.salesEmail,
    technicalPhysical: totals.technicalPhysical,
    technicalOnline: totals.technicalOnline,
    totalActivities: totals.totalActivities,
    uniqueCustomers: totals.uniqueCustomers,
    targets: totals.targets,
  };
  const rows = [...owners, totalRow];

  rows.forEach((row, rowIndex) => {
    const y = tableTop + headerH + rowIndex * rowH;
    const isTotal = rowIndex === rows.length - 1;
    const fill = isTotal ? 'FFF3E8' : (rowIndex % 2 === 0 ? 'F8FBFF' : 'FFFFFF');
    const targetScope = showSummaryTargets ? (isTotal ? totals.targets : row.targets) : undefined;
    const values = [
      row.owner,
      formatActualTarget(row.salesPhysical, targetScope?.salesPhysical),
      formatActualTarget(row.salesOnline, targetScope?.salesOnline),
      formatActualTarget(row.salesPhone, targetScope?.salesPhone),
      formatActualTarget(row.salesEmail, targetScope?.salesEmail),
      formatActualTarget(row.technicalPhysical, targetScope?.technicalPhysical),
      formatActualTarget(row.technicalOnline, targetScope?.technicalOnline),
      formatActualTarget(row.totalActivities, targetScope?.totalActivities),
      formatActualTarget(row.uniqueCustomers, targetScope?.uniqueCustomers),
    ];
    const actualValues = [
      0,
      row.salesPhysical,
      row.salesOnline,
      row.salesPhone,
      row.salesEmail,
      row.technicalPhysical,
      row.technicalOnline,
      row.totalActivities,
      row.uniqueCustomers,
    ];
    const targetValues = [
      0,
      targetScope?.salesPhysical,
      targetScope?.salesOnline,
      targetScope?.salesPhone,
      targetScope?.salesEmail,
      targetScope?.technicalPhysical,
      targetScope?.technicalOnline,
      targetScope?.totalActivities,
      targetScope?.uniqueCustomers,
    ];
    let cellX = left;
    values.forEach((value, idx) => {
      const cellFill = idx === 0 ? fill : contactTargetStatusFill(actualValues[idx], targetValues[idx], fill, isTotal);
      parts.push(makeTextBox(nextId++, `GeneratedContactReportCell_${slideNo}_${rowIndex}_${idx}`, cellX, y, widths[idx], rowH, value, {
        fontSize: idx === 0 ? 760 : 820,
        bold: isTotal || idx === 0,
        color: '1F2937',
        align: idx === 0 ? 'l' : 'ctr',
        fill: cellFill,
        line: tableLine,
        marginLeft: 9000,
        marginRight: 9000,
      }));
      cellX += widths[idx];
    });
  });

  if (!owners.length) {
    parts.push(makeTextBox(nextId++, `GeneratedContactReportEmpty_${slideNo}`, left, tableTop + headerH, contentW, rowH, 'Seçilen tarih aralığında temas edilen müşteri verisi bulunmuyor.', {
      fontSize: 860,
      color: '475569',
      align: 'ctr',
      fill: 'F8FAFC',
      line: tableLine,
    }));
  }

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}

async function injectKasaposIntegrationTable(zip: JSZip, slideNo: number, rows: KasaposIntegrationRow[]) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedKasaposIntegration[\s\S]*?<\/p:sp>/g, '');
  xml = removeSlideTables(xml);

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 300) + 1;
  const slideW = 12192000;
  const slideH = 6858000;
  const left = 280000;
  const top = 900000;
  const headerH = 330000;
  const rowH = 355000;
  const tableW = slideW - left * 2;
  const widths = [420000, 1700000, 1200000, 1850000, 2600000, 900000, 2200000, tableW - 420000 - 1700000 - 1200000 - 1850000 - 2600000 - 900000 - 2200000];
  const headers = ['', 'Kasa Yazılımı', 'Ent Tipi', 'Pilot Müşteri', 'Faz', 'Süreç Sahibi', 'PAX Departmanı', 'Durum'];
  const fitted = rows.slice(0, 12);
  const parts: string[] = [];

  const footerSafeY = 5860000;
  parts.push(makeTextBox(nextId++, `GeneratedKasaposIntegrationCanvas_${slideNo}`, 0, 820000, slideW, Math.max(0, footerSafeY - 820000), '', { fontSize: 1, color: 'FFFFFF', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 0, marginRight: 0 }));

  let x = left;
  headers.forEach((header, idx) => {
    parts.push(makeTextBox(nextId++, `GeneratedKasaposIntegrationHeader_${slideNo}_${idx}`, x, top, widths[idx], headerH, header, { fontSize: 650, bold: true, color: 'FFFFFF', align: 'ctr', fill: '4472C4', line: '1F2937', marginLeft: 22000, marginRight: 22000 }));
    x += widths[idx];
  });

  fitted.forEach((row, rowIndex) => {
    const values = [row.no, row.software, row.integrationType, row.pilotCustomer, row.phase, row.owner, row.department, row.status];
    let cellX = left;
    const y = top + headerH + rowIndex * rowH;
    values.forEach((value, idx) => {
      const align = idx === 0 ? 'ctr' : 'l';
      parts.push(makeTextBox(nextId++, `GeneratedKasaposIntegrationCell_${slideNo}_${rowIndex}_${idx}`, cellX, y, widths[idx], rowH, truncate(value || '-', idx === 4 || idx === 7 ? 70 : 34), { fontSize: 610, color: '111827', align, fill: rowIndex % 2 === 0 ? 'FFFFFF' : 'F8FAFC', line: '1F2937', marginLeft: 22000, marginRight: 22000 }));
      cellX += widths[idx];
    });
  });

  if (!fitted.length) {
    parts.push(makeTextBox(nextId++, `GeneratedKasaposIntegrationEmpty_${slideNo}`, left, top + headerH, sum(widths), rowH, 'Kasa Pos entegrasyon durumu için kayıt bulunmuyor.', { fontSize: 900, color: '475569', align: 'ctr', fill: 'FFFFFF', line: '1F2937' }));
  }

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}
function removeSlideShapesByName(xml: string, names: Array<string | RegExp>) {
  const shouldRemoveName = (name: string) => names.some((item) => (
    typeof item === 'string' ? name === item : item.test(name)
  ));

  const removeByTag = (source: string, tagName: 'sp' | 'graphicFrame' | 'cxnSp' | 'pic') => source.replace(
    new RegExp(`<p:${tagName}>[\\s\\S]*?<p:cNvPr[^>]*name="([^"]*)"[\\s\\S]*?</p:${tagName}>`, 'g'),
    (shape, name) => (shouldRemoveName(String(name || '')) ? '' : shape),
  );

  return (['sp', 'graphicFrame', 'cxnSp', 'pic'] as const).reduce((current, tagName) => removeByTag(current, tagName), xml);
}

async function clearDistributionSlideCanvas(zip: JSZip, slideNo: number) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = removeSlideShapesByName(xml, [
    'Metin kutusu 1',
    /^Eksi İşareti/,
    /^Minus/,
    /^GeneratedDistributionTable/,
    /^GeneratedSegmentTable/,
  ]);
  zip.file(fileName, xml);
}

async function findSlideNoByText(zip: JSZip, tokens: string[], fallbackSlideNo: number) {
  const slideFiles = Object.keys(zip.files)
    .map((name) => {
      const match = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  const normalizedTokens = tokens.map((token) => normalizeText(token)).filter(Boolean);
  for (const slideNo of slideFiles) {
    const file = zip.file(`ppt/slides/slide${slideNo}.xml`);
    if (!file) continue;
    const xml = await file.async('string');
    const text = normalizeText(xml.replace(/<[^>]+>/g, ' '));
    if (normalizedTokens.every((token) => text.includes(token))) return slideNo;
  }
  return fallbackSlideNo;
}


async function removeMondayTrackingSlide(zip: JSZip) {
  for (let guard = 0; guard < 5; guard += 1) {
    const mondaySlideNo = await findSlideNoByText(zip, ['Pazartesi', 'Toplantısı', 'Takip', 'Panosu'], 0);
    if (mondaySlideNo <= 0) return;
    await removeSlide(zip, mondaySlideNo);
  }
}

async function findKasaPosIntegrationStatusSlideNo(zip: JSZip, fallbackSlideNo = 15) {
  return findSlideNoByText(zip, ['Kasa Yazılımı', 'Pilot Müşteri', 'PAX Departmanı', 'Durum'], fallbackSlideNo);
}

async function placeKasaPosIntegrationAfterBusinessPartners(zip: JSZip, afterSlideNo: number, fallbackSlideNo = 15) {
  if (!afterSlideNo) return;
  const kasaPosSlideNo = await findKasaPosIntegrationStatusSlideNo(zip, fallbackSlideNo);
  if (kasaPosSlideNo > 0 && kasaPosSlideNo !== afterSlideNo) {
    await moveSlideAfter(zip, kasaPosSlideNo, afterSlideNo);
  }
}

async function injectDistributionTable(zip: JSZip, slideNo: number, rows: DistributionTableRow[]) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');
  xml = xml.replace(/<p:sp>[\s\S]*?<p:cNvPr id="\d+" name="GeneratedDistributionTable[\s\S]*?<\/p:sp>/g, '');
  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 200) + 1;

  const slideW = 12192000;
  const left = 430000;
  const top = 1040000;
  const headerH = 350000;
  const rowH = 390000;
  const tableW = slideW - left * 2;
  const fixedWidths = [1450000, 1800000, 900000, 820000, 1050000, 1000000, 650000, 1050000, 750000];
  const widths = [...fixedWidths, tableW - fixedWidths.reduce((total, value) => total + value, 0)];
  const headers = ['Firma Adı', 'Faz No / Açıklaması', 'Faz Durumu', 'Tarih', 'KasaPOS Firması', 'Bilgisayar Markası', 'Mağaza', 'EFT-POS Markası', 'Toplam POS', 'Teklif Durumu'];
  const fitted = rows.slice(0, 11);
  const parts: string[] = [];

  // Sablondan gelen govde cizgilerini/yazilarini kapat; baslik, ust dekor, alt sol dalga ve sağ alt PAX logosu korunur.
  const footerSafeY = 5860000;
  parts.push(makeTextBox(nextId++, `GeneratedDistributionTableCanvas_${slideNo}`, 0, 960000, slideW, Math.max(0, footerSafeY - 960000), '', { fontSize: 1, color: 'FFFFFF', fill: 'FFFFFF', line: 'FFFFFF', marginLeft: 0, marginRight: 0 }));

  let x = left;
  headers.forEach((header, idx) => {
    parts.push(makeTextBox(nextId++, `GeneratedDistributionTableHeader_${slideNo}_${idx}`, x, top, widths[idx], headerH, header, { fontSize: idx === 1 ? 740 : idx === 4 ? 720 : 780, bold: true, color: 'FFFFFF', align: 'ctr', fill: '17365D', line: 'FFFFFF', marginLeft: 14000, marginRight: 14000 }));
    x += widths[idx];
  });

  fitted.forEach((row, rowIndex) => {
    const values = [row.company, row.phaseLabel, row.phaseStatus, row.activityDate, row.kasaposFirm, row.computerBrand, row.storeCount, row.eftPosBrand, row.totalPos, row.quoteStatus];
    let cellX = left;
    const y = top + headerH + rowIndex * rowH;
    values.forEach((value, idx) => {
      const align = idx === 3 || idx === 6 || idx === 8 ? 'ctr' : 'l';
      parts.push(makeTextBox(nextId++, `GeneratedDistributionTableCell_${slideNo}_${rowIndex}_${idx}`, cellX, y, widths[idx], rowH, truncate(value || '-', idx === 1 ? 58 : idx === 9 ? 32 : 28), { fontSize: idx === 1 ? 690 : 760, color: '1F2937', align, fill: rowIndex % 2 === 0 ? 'F8FAFC' : 'EEF4FB', line: 'D7E3F4', marginLeft: 14000, marginRight: 14000 }));
      cellX += widths[idx];
    });
  });

  if (!fitted.length) {
    parts.push(makeTextBox(nextId++, `GeneratedDistributionTableEmpty_${slideNo}`, left, top + headerH, sum(widths), rowH, 'Künye tamam, FMSC Dağıtım Kanalları veya Lojistik & Kargo kriterine uygun kayıt bulunmuyor.', { fontSize: 950, color: '475569', align: 'ctr', fill: 'F8FAFC', line: 'D7E3F4' }));
  }

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}


function getMaxValue(items: Array<{ value: number }>) {
  return Math.max(1, ...items.map((item) => toNumber(item.value)));
}

async function injectCustomerDashboardOverviewSlide(zip: JSZip, slideNo: number, payload: WeeklyManagementPresentationPayload) {
  const fileName = `ppt/slides/slide${slideNo}.xml`;
  const file = zip.file(fileName);
  if (!file) return;
  let xml = await file.async('string');

  const removedChartRelIds: string[] = [];
  xml = xml.replace(/<p:graphicFrame>[\s\S]*?<a:graphicData[^>]*uri="http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/chart"[\s\S]*?<c:chart[^>]*r:id="([^"]+)"[\s\S]*?<\/p:graphicFrame>/g, (_match, relId) => {
    removedChartRelIds.push(relId);
    return '';
  });

  // Başlık, PAX logosu ve alt dekor korunur; eski KasaPos kutuları/grafikleri ve önceki üretimler temizlenir.
  xml = removeSlideShapesByName(xml, [
    /^GeneratedCustomerDashboard/,
    /^Text 1$/,
    /^Text 3$/,
    /^Text 4$/,
    /^Text 5$/,
    /^Text 7$/,
    /^Text 8$/,
    /^Text 9$/,
    /^Text 11$/,
    /^Text 12$/,
    /^Text 13$/,
    /^Text 15$/,
    /^Text 16$/,
    /^Text 17$/,
    /^Text 18$/,
    /^Text 19$/,
    /^Shape 2$/,
    /^Shape 6$/,
    /^Shape 10$/,
    /^Shape 14$/,
  ]);

  if (removedChartRelIds.length) {
    const relsName = `ppt/slides/_rels/slide${slideNo}.xml.rels`;
    const relsFile = zip.file(relsName);
    if (relsFile) {
      let relsXml = await relsFile.async('string');
      for (const relId of removedChartRelIds) {
        relsXml = relsXml.replace(new RegExp(`<Relationship\\b[^>]*Id="${escapeRegExp(relId)}"[^>]*/>`, 'g'), '');
      }
      zip.file(relsName, relsXml);
    }
  }

  const dashboard = payload.customerDashboard;
  const total = toNumber(dashboard?.total);
  const portfolioTotal = toNumber((dashboard as any)?.portfolioTotal ?? total);
  const complete = toNumber(dashboard?.kunyeComplete);
  const missing = toNumber(dashboard?.kunyeMissing);
  const none = toNumber(dashboard?.kunyeNone);
  const sectors = toNumber(dashboard?.sectors);
  const accountCount = toNumber(dashboard?.accountCount);
  const activeDiscussedCustomers = toNumber((dashboard as any)?.activeDiscussedCustomers);
  const completionRate = total ? Math.round((complete / Math.max(1, total)) * 100) : toNumber(dashboard?.completionRate);
  const trackable = Math.max(0, total - none);
  const trackableRate = total ? Math.round((trackable / Math.max(1, total)) * 100) : 0;
  const sectorItems = [...(dashboard?.topSectors ?? [])];
  const rawOwnerItems = [...(dashboard?.ownerBars ?? [])];
  const specialOwnerLabels = ['Havuz Account', 'Yemek Kartları', 'İş Ortakları'];
  const specialOwnerItems = specialOwnerLabels
    .map((label) => rawOwnerItems.find((item) => String(item.label || '') === label))
    .filter((item): item is { label: string; value: number } => Boolean(item));
  const regularOwnerItems = rawOwnerItems.filter((item) => !specialOwnerLabels.includes(String(item.label || '')));
  const ownerPanelLimit = 6;
  const ownerItems = [
    ...regularOwnerItems.slice(0, Math.max(0, ownerPanelLimit - specialOwnerItems.length)),
    ...specialOwnerItems,
  ].slice(0, ownerPanelLimit);
  const phaseBuckets = (dashboard?.phaseBuckets ?? []).slice(0, 5);
  const sectorMax = getMaxValue(sectorItems);
  const ownerMax = getMaxValue(ownerItems);
  const phaseMax = getMaxValue(phaseBuckets);

  const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
  let nextId = (ids.length ? Math.max(...ids) : 300) + 1;
  const parts: string[] = [];

  const slideW = 12192000;
  const left = 430000;
  const contentW = slideW - left * 2;
  const white = 'FFFFFF';
  const bg = 'FDFEFF';
  const navy = '17365D';
  const blue = '1F5EAE';
  const blue2 = '2E75B6';
  const text = '14365D';
  const muted = '5D718D';
  const border = 'D7E4F4';
  const track = 'E7EEF7';
  const softBlue = 'EEF6FF';
  const green = '22A967';
  const orange = 'E89A12';
  const gray = '8EA0B6';

  function shape(id: number, name: string, x: number, y: number, cx: number, cy: number, opts: { fill?: string; line?: string; prst?: string } = {}) {
    const fill = opts.fill ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>` : '<a:noFill/>';
    const ln = opts.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${opts.prst ?? 'roundRect'}"><a:avLst/></a:prstGeom>${fill}${ln}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="tr-TR" sz="100"/></a:p></p:txBody></p:sp>`;
  }

  function label(id: number, name: string, x: number, y: number, cx: number, cy: number, value: string, opts: { fontSize?: number; bold?: boolean; color?: string; align?: 'l' | 'ctr' | 'r'; fill?: string; line?: string } = {}) {
    return makeTextBox(id, name, x, y, cx, cy, value, {
      fontSize: opts.fontSize ?? 1000,
      bold: opts.bold,
      color: opts.color ?? text,
      align: opts.align ?? 'l',
      fill: opts.fill,
      line: opts.line,
      marginLeft: 0,
      marginRight: 0,
    });
  }

  function rectBar(name: string, x: number, y: number, w: number, h: number, color: string) {
    if (w <= 0 || h <= 0) return;
    parts.push(shape(nextId++, name, x, y, w, h, { fill: color, line: color, prst: 'rect' }));
  }

  // Temiz içerik zemini: tüm paneller aynı hizaya oturur, watermark okunurluğu bozmaz.
  parts.push(shape(nextId++, `GeneratedCustomerDashboardBase_${slideNo}`, 300000, 1120000, slideW - 600000, 4880000, { fill: bg, line: bg }));

  // Üst KPI satırı: 5 kart aynı genişlik/yükseklikte.
  const kpiY = 1340000;
  const kpiH = 850000;
  const kpiGap = 85000;
  const kpiW = Math.floor((contentW - kpiGap * 4) / 5);
  const kpis = [
    { label: 'Portföy Büyüklüğü', value: formatNumber(portfolioTotal), sub: 'Account yapısındaki müşteri adedi', dark: true },
    { label: 'Aktif Görüşülen Müşteri', value: formatNumber(activeDiscussedCustomers), sub: 'Fazı olan müşteri sayısı' },
    { label: 'Künye Tamam', value: formatNumber(complete), sub: `%${formatNumber(completionRate)} tamamlanma` },
    { label: 'Sektör', value: formatNumber(sectors), sub: 'Tekil sektör kırılımı' },
    { label: 'Account', value: formatNumber(accountCount), sub: 'Sorumlu dağılımı' },
  ];
  kpis.forEach((card, idx) => {
    const x = left + idx * (kpiW + kpiGap);
    const dark = Boolean((card as any).dark);
    parts.push(shape(nextId++, `GeneratedCustomerDashboardKpiCard_${idx}`, x, kpiY, kpiW, kpiH, { fill: dark ? navy : white, line: dark ? navy : border }));
    const labelSize = card.label.length > 18 ? 720 : 870;
    parts.push(label(nextId++, `GeneratedCustomerDashboardKpiLabel_${idx}`, x + 150000, kpiY + 110000, kpiW - 300000, 145000, card.label, { fontSize: labelSize, bold: true, color: dark ? white : text }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardKpiValue_${idx}`, x + 150000, kpiY + 315000, kpiW - 300000, 230000, card.value, { fontSize: 2350, bold: true, color: dark ? white : blue }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardKpiSub_${idx}`, x + 150000, kpiY + 625000, kpiW - 300000, 110000, card.sub, { fontSize: 700, color: dark ? 'DDEBFF' : muted }));
    if (idx === 0) {
      parts.push(shape(nextId++, `GeneratedCustomerDashboardTrackChip_${idx}`, x + 150000, kpiY + 735000, kpiW - 300000, 78000, { fill: '2D6DBD', line: '2D6DBD' }));
      parts.push(label(nextId++, `GeneratedCustomerDashboardTrackChipText_${idx}`, x + 170000, kpiY + 745000, kpiW - 340000, 60000, `${formatNumber(portfolioTotal)} müşteri`, { fontSize: 560, bold: true, color: white, align: 'ctr' }));
    }
  });

  // Orta satır: 3 panel aynı yükseklikte, yakın oranlarda genişlikte.
  const panelY = 2460000;
  const panelH = 1850000;
  const panelGap = 120000;
  const panelW = Math.floor((contentW - panelGap * 2) / 3);
  const qualityX = left;
  const sectorX = left + panelW + panelGap;
  const ownerX = left + (panelW + panelGap) * 2;

  // Künye Sağlığı paneli
  parts.push(shape(nextId++, `GeneratedCustomerDashboardQualityPanel_${slideNo}`, qualityX, panelY, panelW, panelH, { fill: white, line: border }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardQualityTitle_${slideNo}`, qualityX + 180000, panelY + 140000, panelW - 360000, 130000, 'Künye Sağlığı', { fontSize: 1050, bold: true, color: text }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardQualityPct_${slideNo}`, qualityX + 180000, panelY + 390000, 1100000, 250000, `%${formatNumber(completionRate)}`, { fontSize: 2500, bold: true, color: blue }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardQualityPctSub_${slideNo}`, qualityX + 180000, panelY + 680000, 1600000, 90000, 'Künye tamamlama oranı', { fontSize: 760, color: muted }));
  parts.push(shape(nextId++, `GeneratedCustomerDashboardQualityChip_${slideNo}`, qualityX + 1500000, panelY + 450000, panelW - 1770000, 190000, { fill: softBlue, line: softBlue }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardQualityChipText_${slideNo}`, qualityX + 1540000, panelY + 502000, panelW - 1850000, 72000, `${formatNumber(trackable)} takip edilebilir`, { fontSize: 650, bold: true, color: blue, align: 'ctr' }));
  const qTrackX = qualityX + 180000;
  const qTrackY = panelY + 930000;
  const qTrackW = panelW - 360000;
  const completeW = total ? Math.round((complete / total) * qTrackW) : 0;
  const missingW = total ? Math.round((missing / total) * qTrackW) : 0;
  const noneW = Math.max(0, qTrackW - completeW - missingW);
  parts.push(shape(nextId++, `GeneratedCustomerDashboardQualityTrack_${slideNo}`, qTrackX, qTrackY, qTrackW, 100000, { fill: track, line: track, prst: 'rect' }));
  rectBar(`GeneratedCustomerDashboardQualityComplete_${slideNo}`, qTrackX, qTrackY, completeW, 100000, green);
  rectBar(`GeneratedCustomerDashboardQualityMissing_${slideNo}`, qTrackX + completeW, qTrackY, missingW, 100000, orange);
  rectBar(`GeneratedCustomerDashboardQualityNone_${slideNo}`, qTrackX + completeW + missingW, qTrackY, noneW, 100000, gray);
  [
    { label: 'Tamam', value: complete, color: green },
    { label: 'Eksik', value: missing, color: orange },
    { label: 'Yok', value: none, color: gray },
  ].forEach((row, idx) => {
    const y = panelY + 1210000 + idx * 190000;
    parts.push(label(nextId++, `GeneratedCustomerDashboardQualityDot_${idx}`, qTrackX, y, 90000, 95000, '●', { fontSize: 720, color: row.color, align: 'ctr' }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardQualityLabel_${idx}`, qTrackX + 120000, y, 720000, 95000, row.label, { fontSize: 820, color: text }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardQualityValue_${idx}`, qualityX + panelW - 420000, y, 260000, 95000, formatNumber(row.value), { fontSize: 900, bold: true, color: text, align: 'r' }));
  });

  // Sektör Yoğunluğu paneli
  parts.push(shape(nextId++, `GeneratedCustomerDashboardSectorPanel_${slideNo}`, sectorX, panelY, panelW, panelH, { fill: white, line: border }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardSectorTitle_${slideNo}`, sectorX + 180000, panelY + 140000, panelW - 360000, 130000, 'Sektör Yoğunluğu', { fontSize: 1050, bold: true, color: text }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardSectorSub_${slideNo}`, sectorX + 180000, panelY + 310000, panelW - 360000, 90000, 'Ana sektör dağılımı', { fontSize: 760, color: muted }));
  const sectorRowY = panelY + 560000;
  const sectorAvailableH = Math.max(360000, panelH - 700000);
  // Sektör listesini dashboard ile aynı şekilde tam göster: satır sayısına göre dinamik sıkıştır.
  const sectorStep = Math.max(56000, Math.floor(sectorAvailableH / Math.max(1, sectorItems.length)));
  const sectorBarH = sectorStep < 80000 ? 30000 : sectorStep < 120000 ? 42000 : sectorStep < 170000 ? 62000 : 82000;
  const sectorFont = sectorStep < 80000 ? 420 : sectorStep < 120000 ? 520 : sectorStep < 170000 ? 660 : 820;
  sectorItems.forEach((item, idx) => {
    const y = sectorRowY + idx * sectorStep;
    const labelW = 1320000;
    const valueW = 220000;
    const barX = sectorX + 1520000;
    const trackW = panelW - 1520000 - valueW - 160000;
    const value = toNumber(item.value);
    const barW = value > 0 ? Math.max(45000, Math.round((value / sectorMax) * trackW)) : 0;
    parts.push(label(nextId++, `GeneratedCustomerDashboardSectorName_${idx}`, sectorX + 180000, y - 50000, labelW, 100000, String(item.label || 'Tanımsız'), { fontSize: sectorFont, bold: true, color: text }));
    parts.push(shape(nextId++, `GeneratedCustomerDashboardSectorTrack_${idx}`, barX, y, trackW, sectorBarH, { fill: track, line: track, prst: 'rect' }));
    rectBar(`GeneratedCustomerDashboardSectorBar_${idx}`, barX, y, barW, sectorBarH, idx === 0 ? blue : '78AEE8');
    parts.push(label(nextId++, `GeneratedCustomerDashboardSectorValue_${idx}`, sectorX + panelW - valueW - 70000, y - 50000, valueW, 100000, formatNumber(value), { fontSize: sectorFont, bold: true, color: text, align: 'r' }));
  });

  // Account Yapısı paneli
  parts.push(shape(nextId++, `GeneratedCustomerDashboardOwnerPanel_${slideNo}`, ownerX, panelY, panelW, panelH, { fill: white, line: border }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardOwnerTitle_${slideNo}`, ownerX + 180000, panelY + 140000, panelW - 360000, 130000, 'Account Yapısı', { fontSize: 1050, bold: true, color: text }));
  parts.push(label(nextId++, `GeneratedCustomerDashboardOwnerSub_${slideNo}`, ownerX + 180000, panelY + 310000, panelW - 360000, 90000, 'Sorumlu bazlı dağılım', { fontSize: 760, color: muted }));
  const ownerStartY = panelY + 620000;
  const ownerAvailableH = Math.max(900000, panelH - 760000);
  const ownerStep = ownerItems.length > 3
    ? Math.max(175000, Math.floor(ownerAvailableH / Math.max(1, ownerItems.length)))
    : 300000;
  const ownerBarH = ownerStep < 220000 ? 62000 : 90000;
  const ownerFont = ownerStep < 220000 ? 620 : 850;
  const ownerLabelYAdjust = ownerStep < 220000 ? 105000 : 145000;
  ownerItems.forEach((item, idx) => {
    const y = ownerStartY + idx * ownerStep;
    const trackX = ownerX + 180000;
    const trackW = panelW - 520000;
    const value = toNumber(item.value);
    const barW = value > 0 ? Math.max(60000, Math.round((value / ownerMax) * trackW)) : 0;
    parts.push(label(nextId++, `GeneratedCustomerDashboardOwnerName_${idx}`, ownerX + 180000, y - ownerLabelYAdjust, panelW - 520000, 90000, String(item.label || '-'), { fontSize: ownerFont, bold: true, color: text }));
    parts.push(shape(nextId++, `GeneratedCustomerDashboardOwnerTrack_${idx}`, trackX, y, trackW, ownerBarH, { fill: track, line: track, prst: 'rect' }));
    rectBar(`GeneratedCustomerDashboardOwnerBar_${idx}`, trackX, y, barW, ownerBarH, blue);
    parts.push(label(nextId++, `GeneratedCustomerDashboardOwnerValue_${idx}`, ownerX + panelW - 280000, y - ownerLabelYAdjust, 180000, 90000, formatNumber(value), { fontSize: ownerFont, bold: true, color: text, align: 'r' }));
  });

  // Pipeline: alta alınmış, 5 kart aynı boyutta.
  const phaseTitleY = 4520000;
  const phaseY = 4780000;
  parts.push(label(nextId++, `GeneratedCustomerDashboardPhaseTitle_${slideNo}`, left, phaseTitleY, contentW, 140000, 'Pipeline Faz Yolculuğu', { fontSize: 1100, bold: true, color: text }));
  const phaseGap = 100000;
  const phaseCardW = Math.floor((contentW - phaseGap * 4) / 5);
  const phaseCardH = 950000;
  phaseBuckets.forEach((item, idx) => {
    const x = left + idx * (phaseCardW + phaseGap);
    const value = toNumber(item.value);
    const barW = value > 0 ? Math.max(65000, Math.round((value / phaseMax) * (phaseCardW - 300000))) : 0;
    parts.push(shape(nextId++, `GeneratedCustomerDashboardPhaseCard_${idx}`, x, phaseY, phaseCardW, phaseCardH, { fill: white, line: border }));
    parts.push(shape(nextId++, `GeneratedCustomerDashboardPhaseBadge_${idx}`, x + 140000, phaseY + 135000, 310000, 310000, { fill: softBlue, line: softBlue, prst: 'ellipse' }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardPhaseNo_${idx}`, x + 140000, phaseY + 215000, 310000, 90000, String(idx + 1), { fontSize: 660, bold: true, color: blue, align: 'ctr' }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardPhaseLabel_${idx}`, x + 520000, phaseY + 135000, phaseCardW - 660000, 105000, String(item.label || '-'), { fontSize: 820, bold: true, color: text }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardPhaseRange_${idx}`, x + 520000, phaseY + 250000, phaseCardW - 660000, 85000, String(item.range || ''), { fontSize: 620, color: muted }));
    parts.push(label(nextId++, `GeneratedCustomerDashboardPhaseValue_${idx}`, x + 520000, phaseY + 465000, phaseCardW - 660000, 115000, `${formatNumber(value)} müşteri`, { fontSize: 900, bold: true, color: blue }));
    parts.push(shape(nextId++, `GeneratedCustomerDashboardPhaseTrack_${idx}`, x + 140000, phaseY + 740000, phaseCardW - 280000, 78000, { fill: track, line: track, prst: 'rect' }));
    rectBar(`GeneratedCustomerDashboardPhaseBar_${idx}`, x + 140000, phaseY + 740000, barW, 78000, blue);
  });

  xml = xml.replace('</p:spTree>', `${parts.join('')}</p:spTree>`);
  zip.file(fileName, xml);
}

async function applyAllSlideReplacements(zip: JSZip, pristineZip: JSZip, payload: WeeklyManagementPresentationPayload, mode: 'management' | 'seller' = 'management') {
  const replacements = buildSlideReplacements(payload, mode);
  for (const [slideStr, mapping] of Object.entries(replacements)) {
    await rewriteSlideText(zip, Number(slideStr), mapping);
  }
  await injectCustomerDashboardOverviewSlide(zip, 4, payload);
  await injectContactReportSlide(zip, 17, payload, mode);
  const retailSupportSlideNos = mode !== 'seller'
    ? await injectRetailSupportTicketSummarySlides(zip, 16, payload)
    : [];
  const customerMap = buildCustomerMap(payload.customers);
  const weeklyProgressPages = buildWeeklyProgressPages(payload, 'normal');
  await injectWeeklyProgressSlide(zip, 2, weeklyProgressPages[0] || [], payload, 0, weeklyProgressPages.length, 'normal');
  let lastWeeklyProgressSlideNo = 2;
  if (weeklyProgressPages.length > 1) {
    await rewriteSlideText(zip, 3, { 29: 'İlerlemeler, İlk Temaslar ve Tamamlananlar' });
    await injectWeeklyProgressSlide(zip, 3, weeklyProgressPages[1] || [], payload, 1, weeklyProgressPages.length, 'normal');
    lastWeeklyProgressSlideNo = 3;
    for (let pageIndex = 2; pageIndex < weeklyProgressPages.length; pageIndex += 1) {
      const duplicatedSlideNo = await duplicateSlideAfter(zip, lastWeeklyProgressSlideNo);
      if (!duplicatedSlideNo) break;
      lastWeeklyProgressSlideNo = duplicatedSlideNo;
      await rewriteSlideText(zip, duplicatedSlideNo, { 29: 'İlerlemeler, İlk Temaslar ve Tamamlananlar' });
      await injectWeeklyProgressSlide(zip, duplicatedSlideNo, weeklyProgressPages[pageIndex] || [], payload, pageIndex, weeklyProgressPages.length, 'normal');
    }
  } else {
    await clearSlideTextBox(zip, 3, 'TextBox 4');
    await clearSlideTextBox(zip, 3, '矩形: 圆角 47');
    await removeSlide(zip, 3);
  }

  let weeklySectionTailSlideNo = lastWeeklyProgressSlideNo;
  if (mode !== 'seller') {
    for (const retailSlideNo of retailSupportSlideNos) {
      await moveSlideAfter(zip, retailSlideNo, weeklySectionTailSlideNo);
      weeklySectionTailSlideNo = retailSlideNo;
    }
  }

  const businessPartnerProgressPages = buildWeeklyProgressPages(payload, 'businessPartner');
  let lastBusinessPartnerProgressSlideNo = weeklySectionTailSlideNo;
  for (let pageIndex = 0; pageIndex < businessPartnerProgressPages.length; pageIndex += 1) {
    const sourceSlideNo = pageIndex === 0 ? 2 : lastBusinessPartnerProgressSlideNo;
    const duplicatedSlideNo = await duplicateSlideAfter(zip, sourceSlideNo);
    if (!duplicatedSlideNo) break;
    await moveSlideAfter(zip, duplicatedSlideNo, lastBusinessPartnerProgressSlideNo);
    lastBusinessPartnerProgressSlideNo = duplicatedSlideNo;
    await rewriteSlideText(zip, duplicatedSlideNo, { 0: BUSINESS_PARTNER_PROGRESS_TITLE, 29: BUSINESS_PARTNER_PROGRESS_TITLE });
    await injectWeeklyProgressSlide(zip, duplicatedSlideNo, businessPartnerProgressPages[pageIndex] || [], payload, pageIndex, businessPartnerProgressPages.length, 'businessPartner');
  }

  await removeMondayTrackingSlide(zip);
  await placeKasaPosIntegrationAfterBusinessPartners(zip, lastBusinessPartnerProgressSlideNo, 15);

  // Satışçı sunumunda Jira/Retail Support slaytı hiç yer almamalı.
  // Sadece içeriği boşaltmak yerine slaytı paketten kaldırıyoruz; boş sayfa kalmaz.
  if (mode === 'seller') {
    await removeSlide(zip, 16);
  }

  await injectTopAccountsTable(zip, 5, payload.topCompletedAccounts.slice(0, 10), `Toplam tamamlanan: ${formatNumber(phaseGroupChartData(payload.completedPhaseChartAccounts ?? payload.completedPhaseAccounts ?? payload.topCompletedAccounts ?? []).reduce((total, item) => total + toNumber(item.value), 0))} Firma`);
  await injectTopAccountsTable(zip, 6, payload.topActiveAccounts.slice(0, 10), `Toplam devam eden pipeline: ${formatNumber(payload.summary.pipelinePosDevices)} POS cihazı`);

  const riskLines = buildWeeklyRiskLines(payload, customerMap);
  await replaceHighlightBody(zip, 7, riskLines.length ? riskLines : ['Bu hafta kritik risk notu bulunmuyor.']);
  await upsertCountCircle(
    zip,
    7,
    riskLines.length,
    { x: 10925176, y: 858754, cx: 634058, cy: 634058 },
    { name: 'WeeklyRiskCountCircle', fill: RISK_ACCENT_RED, fontSize: 2100 },
  );
  await recolorRiskSlideDecorations(zip, 7);

  const distributionCustomers = mode === 'seller' ? payload.customers : getDistributionReportCustomers(payload);
  const distributionSummary = buildSegmentReportSummary(distributionCustomers);
  const distributionRows = buildDistributionTableRows(payload, mode);
  const distributionPageSize = 11;
  const distributionPages = Array.from({ length: Math.max(1, Math.ceil(distributionRows.length / distributionPageSize)) }, (_, index) => (
    distributionRows.slice(index * distributionPageSize, (index + 1) * distributionPageSize)
  ));

  await clearDistributionSlideCanvas(zip, 8);
  await injectDistributionTable(zip, 8, distributionPages[0] || []);
  await injectSegmentReportHeader(zip, 8, mode === 'seller' ? 'Account Müşterileri Genel Durum Raporu' : 'Dağıtım Kanalı ve Zincir Noktaları Genel Durum Raporu', distributionSummary);
  let lastDistributionSlideNo = 8;
  for (let pageIndex = 1; pageIndex < distributionPages.length; pageIndex += 1) {
    const duplicatedSlideNo = await duplicateSlideAfter(zip, lastDistributionSlideNo);
    if (!duplicatedSlideNo) break;
    lastDistributionSlideNo = duplicatedSlideNo;
    await clearDistributionSlideCanvas(zip, duplicatedSlideNo);
    await injectDistributionTable(zip, duplicatedSlideNo, distributionPages[pageIndex] || []);
    await injectSegmentReportHeader(zip, duplicatedSlideNo, mode === 'seller' ? 'Account Müşterileri Genel Durum Raporu' : 'Dağıtım Kanalı ve Zincir Noktaları Genel Durum Raporu', distributionSummary);
  }

  await removeSlide(zip, 10);
  await removeSlide(zip, 11);
  await removeSlide(zip, 12);
  const legacyOtherSlideNo = await findSlideNoByText(zip, ['Encore', 'EnPOS'], 13);
  if (legacyOtherSlideNo !== 9) await removeSlide(zip, legacyOtherSlideNo);

  if (mode === 'seller') {
    await removeSlide(zip, 9);
    for (const tokens of [
      ['Retail Support', 'Ticket'],
    ]) {
      const slideNo = await findSlideNoByText(zip, tokens, 0);
      if (slideNo > 0) await removeSlide(zip, slideNo);
    }
  } else {
    const kasaposFirmGroups = buildKasaposFirmReportGroups(payload);
    const firmReportPageSize = 11;
    let lastFirmReportSlideNo = 9;

    if (!kasaposFirmGroups.length) {
      await clearDistributionSlideCanvas(zip, 9);
      await injectSegmentTable(zip, 9, [], 'Aktivite girilmiş KasaPOS firması kaydı bulunmuyor.');
      await injectSegmentReportHeader(zip, 9, 'KasaPOS Firmaları Genel Durum Raporu', buildSegmentReportSummary([]));
    }

    for (let groupIndex = 0; groupIndex < kasaposFirmGroups.length; groupIndex += 1) {
      const group = kasaposFirmGroups[groupIndex];
      const pages = Array.from({ length: Math.max(1, Math.ceil(group.rows.length / firmReportPageSize)) }, (_, index) => (
        group.rows.slice(index * firmReportPageSize, (index + 1) * firmReportPageSize)
      ));

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        let slideNo = lastFirmReportSlideNo;
        if (!(groupIndex === 0 && pageIndex === 0)) {
          const duplicatedSlideNo = await duplicateSlideAfter(zip, lastFirmReportSlideNo);
          if (!duplicatedSlideNo) break;
          slideNo = duplicatedSlideNo;
          lastFirmReportSlideNo = duplicatedSlideNo;
        }

        await clearDistributionSlideCanvas(zip, slideNo);
        await injectSegmentTable(zip, slideNo, pages[pageIndex] || [], `Aktivite girilmiş, KasaPOS firması ${group.firmName} olan kayıt bulunmuyor.`);
        await injectSegmentReportHeader(zip, slideNo, kasaposFirmReportTitle(group.firmName), buildSegmentReportSummary(group.customers));
      }
    }
    await restoreStaticTemplateSlides(zip, pristineZip);
    await removeMondayTrackingSlide(zip);
    await placeKasaPosIntegrationAfterBusinessPartners(zip, lastBusinessPartnerProgressSlideNo, 15);
  }
}

export async function generateWeeklyManagementPresentationPptx(admin: any, options?: { from?: string; to?: string; owner?: string; segment?: string; sellerMode?: boolean }) {
  const payload = await buildWeeklyManagementPresentation(admin, options);
  const templatePath = path.join(process.cwd(), 'templates', 'weekly-management-template.pptx');
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  const pristineZip = await JSZip.loadAsync(templateBuffer);
  await applyAllSlideReplacements(zip, pristineZip, payload, options?.sellerMode ? 'seller' : 'management');
  await applyCharts(zip, payload);
  if (!options?.sellerMode) await restoreStaticTemplateSlides(zip, pristineZip);
  await sanitizePresentationPackage(zip);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, payload };
}
