import { fetchAllByCustomerIds, fetchAllRows } from '@/lib/reporting';
import { getCustomerPhaseMeta } from '@/lib/customer-phase';
import { getKunyeStatus, mapKunyeDbToUi } from '@/lib/kunye';
import { isMissingRelationError } from '@/lib/quotes/service';
import { isReportOnlyCustomer, reportOnlyCustomerKind } from '@/lib/report-only-customers';
import { buildJiraWeeklyTicketSummary, type JiraWeeklyTicketSummary } from '@/lib/jira-weekly-tickets';
import { getSystemParameterBoolean } from '@/lib/system-parameters';
import { db } from '@/lib/db';


type WeeklyContactTargets = {
  salesPhysical: number;
  salesOnline: number;
  salesPhone: number;
  salesEmail: number;
  technicalPhysical: number;
  technicalOnline: number;
  uniqueCustomers: number;
  totalActivities: number;
};

function emptyWeeklyContactTargets(): WeeklyContactTargets {
  return {
    salesPhysical: 0,
    salesOnline: 0,
    salesPhone: 0,
    salesEmail: 0,
    technicalPhysical: 0,
    technicalOnline: 0,
    uniqueCustomers: 0,
    totalActivities: 0,
  };
}

function addWeeklyContactTargets(a: WeeklyContactTargets, b: WeeklyContactTargets): WeeklyContactTargets {
  return {
    salesPhysical: a.salesPhysical + b.salesPhysical,
    salesOnline: a.salesOnline + b.salesOnline,
    salesPhone: a.salesPhone + b.salesPhone,
    salesEmail: a.salesEmail + b.salesEmail,
    technicalPhysical: a.technicalPhysical + b.technicalPhysical,
    technicalOnline: a.technicalOnline + b.technicalOnline,
    uniqueCustomers: a.uniqueCustomers + b.uniqueCustomers,
    totalActivities: a.totalActivities + b.totalActivities,
  };
}

function hasWeeklyContactTarget(targets: WeeklyContactTargets) {
  return Object.values(targets).some((value) => Number(value ?? 0) > 0);
}

function targetsFromDbRow(row: any): WeeklyContactTargets {
  const targets = {
    salesPhysical: Number(row?.weekly_target_sales_physical ?? 0) || 0,
    salesOnline: Number(row?.weekly_target_sales_online ?? 0) || 0,
    salesPhone: Number(row?.weekly_target_sales_phone ?? 0) || 0,
    salesEmail: Number(row?.weekly_target_sales_email ?? 0) || 0,
    technicalPhysical: Number(row?.weekly_target_technical_physical ?? 0) || 0,
    technicalOnline: Number(row?.weekly_target_technical_online ?? 0) || 0,
    uniqueCustomers: Number(row?.weekly_target_unique_customers ?? 0) || 0,
    totalActivities: Number(row?.weekly_target_total_activities ?? 0) || 0,
  };
  return targets;
}

async function ensureAllowedUserWeeklyTargetColumns() {
  await db.query(`
    alter table public.allowed_users
      add column if not exists weekly_target_sales_physical integer not null default 0,
      add column if not exists weekly_target_sales_online integer not null default 0,
      add column if not exists weekly_target_sales_phone integer not null default 0,
      add column if not exists weekly_target_sales_email integer not null default 0,
      add column if not exists weekly_target_technical_physical integer not null default 0,
      add column if not exists weekly_target_technical_online integer not null default 0,
      add column if not exists weekly_target_total_activities integer not null default 0,
      add column if not exists weekly_target_unique_customers integer not null default 0
  `);
}

async function loadWeeklyContactTargetMap() {
  try {
    await ensureAllowedUserWeeklyTargetColumns();
    const result = await db.query(`
      select full_name,
        weekly_target_sales_physical,
        weekly_target_sales_online,
        weekly_target_sales_phone,
        weekly_target_sales_email,
        weekly_target_technical_physical,
        weekly_target_technical_online,
        weekly_target_total_activities,
        weekly_target_unique_customers
      from public.allowed_users
      where is_active = true
    `);
    const map = new Map<string, WeeklyContactTargets>();
    for (const row of result.rows ?? []) {
      const owner = cleanText(row.full_name, '');
      if (owner) map.set(owner, targetsFromDbRow(row));
    }
    return map;
  } catch (_error) {
    return new Map<string, WeeklyContactTargets>();
  }
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseNumericValue(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeMap(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

function summarizeValues(values: Array<string | null | undefined>, fallback = '-') {
  const map = new Map<string, number>();
  for (const raw of values) {
    const label = String(raw ?? '').replace(/\s+/g, ' ').trim() || fallback;
    if (!label || label === '-') continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return summarizeMap(map);
}

function summarizeDashboardValues(values: Array<string | null | undefined>, fallback = '-') {
  const map = new Map<string, number>();
  for (const raw of values) {
    const label = String(raw ?? '').replace(/\s+/g, ' ').trim() || fallback;
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return summarizeMap(map);
}

function countUniqueValues(values: Array<string | null | undefined>) {
  return new Set(values.map((item) => String(item ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)).size;
}

function parseDashboardPhaseNo(label: string) {
  const match = String(label ?? '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function sumDashboardPhaseRange(items: Array<{ label: string; value: number }>, min: number, max: number) {
  return items.reduce((acc, item) => {
    const no = parseDashboardPhaseNo(item.label);
    if (no != null && no >= min && no <= max) return acc + Number(item.value ?? 0);
    return acc;
  }, 0);
}

function buildDashboardPhaseBucketsFromStats(items: Array<{ label: string; value: number }>) {
  return [
    { key: 'lead', label: 'Fırsat İlk Temas', range: 'Faz 1-4', value: sumDashboardPhaseRange(items, 1, 4) },
    { key: 'contact', label: 'Analiz + Sunumlar', range: 'Faz 5-9', value: sumDashboardPhaseRange(items, 5, 9) },
    { key: 'business', label: 'Business', range: 'Faz 10-14', value: sumDashboardPhaseRange(items, 10, 14) },
    { key: 'operation', label: 'Operasyon', range: 'Faz 15-23', value: sumDashboardPhaseRange(items, 15, 23) },
    { key: 'rollout', label: 'Yayılım', range: 'Faz 24-25', value: sumDashboardPhaseRange(items, 24, 25) },
  ];
}

function cleanText(value: unknown, fallback = '-') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function cleanOptionalText(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
}


function buildPhaseTitle(phaseNo: number | null | undefined, phaseName?: string | null) {
  if (phaseNo == null) return 'Faz bilgisi yok';
  const cleanName = String(phaseName ?? '').replace(/\s+/g, ' ').trim();
  return cleanName ? `Faz ${phaseNo} - ${cleanName}` : `Faz ${phaseNo}`;
}

function normalizeDistributionLabel(value: unknown) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text === '-' || /^yok$/i.test(text) || /^belirsiz$/i.test(text)) return '';
  return text;
}

function normalizeEftPosBrandLabel(value: unknown, options?: { allowRawUnknown?: boolean }) {
  const text = normalizeDistributionLabel(value);
  if (!text) return '';

  const normalized = text.toLocaleLowerCase('tr-TR');
  if (normalized.includes('ingenico')) return 'Ingenico';
  if (normalized.includes('verifone')) return 'Verifone';
  if (normalized.includes('pax')) return 'PAX';
  if (normalized.includes('pavo')) return 'Pavo';
  if (normalized.includes('hugin')) return 'Hugin';
  if (normalized.includes('sunmi')) return 'Sunmi';
  if (normalized.includes('profilo')) return 'Profilo';
  if (normalized.includes('beko')) return 'Beko';
  if (normalized.includes('vera')) return 'Vera';
  if (normalized.includes('inpos')) return 'Inpos';
  if (/^(diğer|diger|other)$/i.test(text)) return 'Diğer';

  return options?.allowRawUnknown ? text : '';
}

function pickEftPosBrandForReport(rawBrand: unknown) {
  return normalizeEftPosBrandLabel(rawBrand, { allowRawUnknown: true });
}

function pickDistributionLabel(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeDistributionLabel(value);
    if (normalized) return normalized;
  }
  return '';
}

async function loadKunyeRows(admin: any, customerIds: string[]) {
  if (!customerIds.length) return [];

  // Müşteriler Dashboard üst kartları / filtreleri v_musteri_kunye_status kaynağını kullanıyor.
  // Yönetim sunumundaki KasaPos Pipeline Raporu da aynı müşteri + künye kaynağından beslensin.
  // View yoksa eski künye tablosuna sadece güvenli fallback yapıyoruz.
  try {
    return await fetchAllByCustomerIds<any>(admin, 'v_musteri_kunye_status', '*', customerIds);
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  try {
    return await fetchAllByCustomerIds<any>(admin, 'musteri_kunye_v2', '*', customerIds);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function loadQuoteItemRows(admin: any, quoteIds: string[]) {
  if (!quoteIds.length) return [];

  try {
    return await fetchAllByCustomerIds<any>(
      admin,
      'quote_items',
      'quote_id,product_code_snapshot,product_name_snapshot,product_type,quantity,is_recurring',
      quoteIds,
      undefined,
      { idColumn: 'quote_id' },
    );
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

function summarizeQuoteDeviceItems(items: Array<{ label: string; quantity: number }>) {
  if (!items.length) return '-';
  return items
    .slice()
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, 'tr'))
    .map((item) => `${item.label}: ${item.quantity}`)
    .join(', ');
}

function phaseBucket(phaseNo: number | null | undefined) {
  const meta = getCustomerPhaseMeta(phaseNo ?? null);
  const phase = phaseNo == null ? null : Number(phaseNo);
  const isCompleted = phase != null && phase >= 24;
  const isActive = phase != null && phase < 24;
  return {
    phase,
    group: meta.groupLabel,
    isCompleted,
    isActive,
  };
}

function normalizeForSearch(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}


function normalizeDashboardKey(value: unknown) {
  return normalizeForSearch(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

type RetailDashboardAccountRow = {
  customer?: string | null;
  owner?: string | null;
  sector?: string | null;
};

function retailDashboardSpecialOwnerLabel(owner: unknown): string | null {
  const normalized = normalizeDashboardKey(owner);
  if (!normalized) return null;
  if (normalized === 'cem koc' || normalized === 'havuz account') return 'Havuz Account';
  if (normalized === 'seda kesikoglu' || normalized === 'yemek kartlari') return 'Yemek Kartları';
  if (normalized === 'is ortaklari' || normalized === 'is ortagi') return 'İş Ortakları';
  return null;
}

function retailDashboardSpecialAccountLabel(row: RetailDashboardAccountRow): string | null {
  if (reportOnlyCustomerKind({ musteri: row.customer, sorumlu: row.owner, sektor: row.sector }) === 'business-partner') {
    return 'İş Ortakları';
  }
  return retailDashboardSpecialOwnerLabel(row.owner);
}

function isRetailDashboardSpecialAccount(row: RetailDashboardAccountRow) {
  return Boolean(retailDashboardSpecialAccountLabel(row));
}

function isRetailDashboardExcludedSector(sector: unknown) {
  const normalized = normalizeDashboardKey(sector);
  return normalized === 'banka' || normalized === 'vertical' || normalized === 'vertikal';
}

function sellerPresentationOwnerLabel(row: RetailDashboardAccountRow): string {
  if (reportOnlyCustomerKind({ musteri: row.customer, sorumlu: row.owner, sektor: row.sector }) === 'business-partner') return 'İş Ortakları';
  return cleanText(row.owner, '');
}

function retailDashboardAccountLabel(row: RetailDashboardAccountRow): string {
  const specialLabel = retailDashboardSpecialAccountLabel(row);
  if (specialLabel) return specialLabel;
  return String(row.owner ?? '').replace(/\s+/g, ' ').trim();
}

function hasRetailDashboardAccount(row: RetailDashboardAccountRow) {
  return Boolean(retailDashboardAccountLabel(row));
}

function buildRetailDashboardOwnerBars(rows: RetailDashboardAccountRow[]) {
  const regular = new Map<string, number>();
  const special = new Map<string, number>();
  for (const row of rows) {
    const specialLabel = retailDashboardSpecialAccountLabel(row);
    if (specialLabel) {
      special.set(specialLabel, (special.get(specialLabel) ?? 0) + 1);
      continue;
    }

    const owner = retailDashboardAccountLabel(row);
    if (!owner) continue;
    regular.set(owner, (regular.get(owner) ?? 0) + 1);
  }

  const orderedSpecial = ['Havuz Account', 'Yemek Kartları', 'İş Ortakları']
    .map((label) => ({ label, value: special.get(label) ?? 0 }))
    .filter((row) => row.value > 0);

  return [
    ...summarizeMap(regular),
    ...orderedSpecial,
  ];
}

function countRetailDashboardFieldOwners(rows: RetailDashboardAccountRow[]) {
  const owners = new Set<string>();
  for (const row of rows) {
    if (isRetailDashboardSpecialAccount(row)) continue;
    const owner = retailDashboardAccountLabel(row);
    if (owner) owners.add(owner);
  }
  return owners.size;
}

function includesAny(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function detectCategoryFromText(value: string) {
  const text = normalizeForSearch(value);
  if (includesAny(text, ['tamam', 'sipariş', 'teslim', 'yaygınlaştır', 'kazan', 'kapandı', 'kapan', 'devreye'])) return 'completed';
  if (includesAny(text, ['blokaj', 'kritik', 'risk', 'bekli', 'problem', 'muafiyet'])) return 'risk';
  if (includesAny(text, ['poc', 'pilot', 'test'])) return 'pilot';
  return 'progress';
}

function normalizeActivityStatus(value: unknown) {
  const text = normalizeForSearch(value);
  if (!text) return '';
  if (includesAny(text, ['tamamlandı', 'tamamlanan'])) return 'completed';
  if (includesAny(text, ['devam ediyor', 'devam edıyor', 'devam'])) return 'active';
  if (includesAny(text, ['ihtiyaç duyulmadı', 'ihtiyac duyulmadi'])) return 'cancelled';
  if (includesAny(text, ['başlamadı', 'baslamadi'])) return 'not_started';
  return text;
}

function applyActivityPhaseToCustomer(
  customer: PresentationCustomer,
  activity: ActivityRow | null | undefined,
  phaseNameMap?: Map<number, string>,
): PresentationCustomer {
  if (!activity) return customer;
  const phaseNo = activity.phase_no == null ? customer.phase_no : activity.phase_no;
  const phaseMeta = getCustomerPhaseMeta(phaseNo ?? null);
  const phaseName = phaseNo == null ? customer.phase_name : (phaseNameMap?.get(phaseNo) ?? customer.phase_name ?? null);
  return {
    ...customer,
    phase_no: phaseNo,
    phase_name: phaseName,
    phase_group: phaseMeta.groupLabel,
    phase_status: cleanText(activity.status, customer.phase_status || '-'),
  };
}

function detectSegment(row: Pick<PresentationCustomer, 'kasapos_firmasi' | 'sabit_bilgisayar_markasi' | 'entegrasyon_tipi'>) {
  const kasapos = normalizeForSearch(row.kasapos_firmasi);
  const other = normalizeForSearch(`${row.kasapos_firmasi} ${row.sabit_bilgisayar_markasi} ${row.entegrasyon_tipi}`);
  if (kasapos.includes('nebim')) return 'Nebim';
  if (kasapos.includes('toshiba')) return 'Toshiba';
  if (includesAny(other, ['encore', 'enpos', 'logo', 'microsoft dynamics'])) return 'Encore / EnPOS / Logo / Dynamics';
  return 'Encore / EnPOS / Logo / Dynamics';
}

function parseActivityType(aksiyon: unknown, eventType: unknown) {
  const actionRaw = cleanText(aksiyon, '');
  const eventRaw = cleanText(eventType, '');
  const action = actionRaw.replace(/^AKT[Iİ]V[Iİ]TE:/i, '').trim();
  const event = eventRaw.replace(/^AKT[Iİ]V[Iİ]TE:/i, '').trim();

  // Aktivite ekranında seçilen gerçek tip pipeline_eventleri.aksiyon alanında
  // AKTIVITE:<tip> formatıyla tutulur. event_type çoğu kayıtta note_added olduğu için
  // rapor filtresinde tek başına güvenilir değildir.
  if (/^AKT[Iİ]V[Iİ]TE:/i.test(actionRaw) && action) return action;
  if (event && !['note_added', 'note added', 'created', 'updated'].includes(normalizeForSearch(event))) return event;
  if (action) return action;
  return 'Diğer';
}

function normalizeActivityKind(value: unknown) {
  const text = normalizeForSearch(value);
  if (!text) return 'other';

  const isTechnical = includesAny(text, ['teknik', 'pom']);
  const isSales = includesAny(text, ['satış', 'satis', 'sales']) || !isTechnical;

  if (text === 'pom' || includesAny(text, ['pom'])) return 'technicalOnline';
  if (isTechnical && includesAny(text, ['online', 'teams', 'meet', 'uzaktan', 'video'])) return 'technicalOnline';
  if (isTechnical && includesAny(text, ['fiziki', 'fizik', 'yerinde', 'saha', 'ziyaret', 'toplantı', 'toplanti'])) return 'technicalPhysical';

  if (isSales && includesAny(text, ['e-posta', 'eposta', 'e posta', 'mail'])) return 'salesEmail';
  if (isSales && includesAny(text, ['telefon', 'phone', 'arama', 'çağrı', 'cagri'])) return 'salesPhone';
  if (isSales && includesAny(text, ['online', 'teams', 'meet', 'uzaktan', 'video'])) return 'salesOnline';
  if (isSales && includesAny(text, ['fiziki', 'fizik', 'yerinde', 'saha', 'ziyaret', 'toplantı', 'toplanti'])) return 'salesPhysical';

  return 'other';
}

function isTechnicalChannelLike(value: unknown) {
  const text = normalizeForSearch(value);
  return includesAny(text, ['teknik ziyaret', 'teknik online', 'pom', 'teknik toplant', 'teknik destek', 'servis']);
}

function stripActivityPrefix(value: unknown) {
  return String(value ?? '').replace(/^AKT[Iİ]V[Iİ]TE:/i, '').replace(/^AKTIVITE:/i, '').trim();
}

function isContactActivity(row: ActivityRow) {
  const rawAction = String(row.raw_action ?? '').trim();

  // Temas Edilen Müşteriler slaytı artık aktivite tiplerini satış/teknik ve kanal bazında ayrıştırır.
  // Doğru kaynak Aktivite ekranında seçilen tiptir; bu tip pipeline_eventleri.aksiyon alanında
  // AKTIVITE:<tip> formatıyla tutulur. Eski kayıtlar için event_type fallback'i parseActivityType içindedir.
  if (/^AKT[Iİ]V[Iİ]TE:/i.test(rawAction) || /^AKTIVITE:/i.test(rawAction)) return true;
  return normalizeActivityKind(row.activity_type) !== 'other';
}

function isYerindeZiyaretActivity(row: Pick<ActivityRow, 'activity_type' | 'raw_action' | 'raw_event_type'>) {
  const rawActionType = normalizeForSearch(stripActivityPrefix(row.raw_action));
  const rawEventType = normalizeForSearch(stripActivityPrefix(row.raw_event_type));
  const parsedType = normalizeForSearch(row.activity_type);

  // Öncelik ekrandaki Aktivite Tipi alanını temsil eden aksiyon kolonudur.
  // AKTIVITE: prefix'i temizlenerek karşılaştırılır; aksi halde Türkçe lower-case
  // dönüşümündeki I/ı farkı yüzünden Yerinde Ziyaret kayıtları kaçıyordu.
  if (rawActionType) return rawActionType === 'yerinde ziyaret';

  // Eski kayıtlar için event_type doğrudan aktivite tipi tutulmuş olabilir.
  if (rawEventType && !['note_added', 'note added', 'created', 'updated'].includes(rawEventType)) {
    return rawEventType === 'yerinde ziyaret';
  }

  return parsedType === 'yerinde ziyaret';
}

function normalizedActivityType(row: Pick<ActivityRow, 'activity_type' | 'raw_action' | 'raw_event_type'>) {
  const rawActionType = normalizeForSearch(stripActivityPrefix(row.raw_action));
  const rawEventType = normalizeForSearch(stripActivityPrefix(row.raw_event_type));
  const parsedType = normalizeForSearch(row.activity_type);
  if (rawActionType) return rawActionType;
  if (rawEventType && !['note_added', 'note added', 'created', 'updated'].includes(rawEventType)) return rawEventType;
  return parsedType;
}

function isTechnicalActivity(row: Pick<ActivityRow, 'activity_type' | 'raw_action' | 'raw_event_type'>) {
  const type = normalizedActivityType(row);
  return type === 'teknik online' || type === 'teknik ziyaret' || type === 'pom';
}

function parseDateMs(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isWithinDateRange(row: Pick<ActivityRow, 'created_at'>, from: string, to: string) {
  const valueMs = parseDateMs(row.created_at);
  const fromMs = Date.parse(`${from}T00:00:00`);
  const toMs = Date.parse(`${to}T23:59:59.999`);
  if (!Number.isFinite(valueMs) || !Number.isFinite(fromMs) || !Number.isFinite(toMs)) return false;
  return valueMs >= fromMs && valueMs <= toMs;
}

function activityCustomerKey(row: ActivityRow) {
  return String(row.musteri_id || row.customer || '').trim();
}

function pickUniqueLatest(rows: ActivityRow[]) {
  const sorted = rows.slice().sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at));
  const map = new Map<string, ActivityRow>();
  for (const row of sorted) {
    const key = activityCustomerKey(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
}

function pickUniqueEarliest(rows: ActivityRow[]) {
  const sorted = rows.slice().sort((a, b) => parseDateMs(a.created_at) - parseDateMs(b.created_at));
  const map = new Map<string, ActivityRow>();
  for (const row of sorted) {
    const key = activityCustomerKey(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
}

function activityCustomerPhaseKey(row: ActivityRow) {
  const customerKey = activityCustomerKey(row);
  const phaseKey = row.phase_no != null ? String(row.phase_no) : cleanText(row.phase_name || row.phase || '-', '-');
  return `${customerKey}__${phaseKey}`;
}

function pickUniqueLatestByCustomerPhase(rows: ActivityRow[]) {
  const sorted = rows.slice().sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at));
  const map = new Map<string, ActivityRow>();
  for (const row of sorted) {
    const key = activityCustomerPhaseKey(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
}

function buildPhaseChangeFlagMap(rows: ActivityRow[]) {
  const byCustomer = new Map<string, ActivityRow[]>();
  for (const row of rows) {
    const key = activityCustomerKey(row);
    if (!key) continue;
    const bucket = byCustomer.get(key) ?? [];
    bucket.push(row);
    byCustomer.set(key, bucket);
  }

  const flags = new Map<string, boolean>();
  for (const bucket of byCustomer.values()) {
    let lastMeaningfulPhase: number | null = null;
    const sorted = bucket.slice().sort((a, b) => parseDateMs(a.created_at) - parseDateMs(b.created_at));
    for (const row of sorted) {
      const currentPhase = row.phase_no == null ? null : Number(row.phase_no);
      const isPlanned = normalizeActivityStatus(row.status) === 'not_started';
      const changed = !isPlanned && lastMeaningfulPhase != null && currentPhase != null && currentPhase !== lastMeaningfulPhase;
      if (row.id) flags.set(row.id, changed);
      if (!isPlanned && currentPhase != null) lastMeaningfulPhase = currentPhase;
    }
  }
  return flags;
}

function toNarrativeItem(row: ActivityRow, note?: string) {
  return {
    customer: row.customer,
    note: cleanText(note ?? row.notes),
    owner: row.created_by,
    phase: row.phase,
    phase_no: row.phase_no,
    phase_name: row.phase_name,
    phase_status: cleanText(row.status, '-'),
    waiting: row.waiting,
    created_at: row.created_at,
    activity_type: row.activity_type,
    affects_phase: row.affects_phase,
  };
}

function sortByPosThenName(a: PresentationCustomer, b: PresentationCustomer) {
  return (b.pos_count ?? 0) - (a.pos_count ?? 0) || a.customer.localeCompare(b.customer, 'tr');
}

export type PresentationCustomer = {
  musteri_id: string;
  customer: string;
  owner: string;
  sector: string;
  entegrasyon_tipi: string;
  phase_no: number | null;
  phase_name: string | null;
  phase_group: string;
  kasapos_firmasi: string;
  sabit_bilgisayar_markasi: string;
  pos_modeli: string;
  pos_markasi: string;
  store_count: number | null;
  store_count_text?: string | null;
  pos_count: number | null;
  phase_status: string;
  quote_count: number;
  total_quote_amount: number;
  quote_numbers: string[];
  quote_device_items: Array<{ label: string; quantity: number }>;
  quote_device_summary: string;
  quote_device_total: number;
  latest_activity_date: string;
  kunye_status: 'Var' | 'Eksik' | 'Yok';
};

export type ActivityRow = {
  id: string;
  musteri_id: string;
  created_at: string;
  created_by: string;
  responsible: string;
  customer: string;
  sector: string;
  integration: string;
  phase: string;
  phase_no: number | null;
  phase_name: string | null;
  waiting: string;
  status: string;
  notes: string;
  activity_type: string;
  raw_action: string;
  raw_event_type: string;
  affects_phase: boolean;
  activity_scope: string;
  is_blocked: boolean;
  blocked_note: string;
};

export type WeeklyActivityNarrativeItem = {
  customer: string;
  note: string;
  owner: string;
  phase: string;
  phase_no: number | null;
  phase_name: string | null;
  phase_status: string;
  waiting: string;
  created_at: string;
  activity_type: string;
  affects_phase: boolean;
};

export type WeeklyManagementPresentationPayload = {
  filters: {
    from: string;
    to: string;
    ownerOptions: string[];
    segmentOptions: string[];
    selectedOwner: string;
    selectedSegment: string;
  };
  summary: {
    totalAccounts: number;
    totalPosDevices: number;
    activeProjects: number;
    completedAccounts: number;
    pipelinePosDevices: number;
    completedPosDevices: number;
    weeklyActivities: number;
    activePeople: number;
    quoteCount: number;
    quoteAmount: number;
    kunyeCoveragePct: number;
  };
  phaseSummary: Array<{ label: string; totalAccounts: number; totalPos: number }>;
  eftPosBrandDistribution: Array<{ label: string; value: number }>;
  kasaposDistribution: Array<{ label: string; value: number }>;
  topActiveAccounts: PresentationCustomer[];
  topCompletedAccounts: PresentationCustomer[];
  pipelineAccounts: PresentationCustomer[];
  activePhaseAccounts: PresentationCustomer[];
  completedPhaseAccounts: PresentationCustomer[];
  activePhaseChartAccounts: PresentationCustomer[];
  completedPhaseChartAccounts: PresentationCustomer[];
  weeklyHighlights: WeeklyActivityNarrativeItem[];
  weeklyNewContacts: WeeklyActivityNarrativeItem[];
  weeklyPhaseChangedProgress: WeeklyActivityNarrativeItem[];
  weeklyPhaseUnchangedProgress: WeeklyActivityNarrativeItem[];
  weeklyTechnicalActivities: WeeklyActivityNarrativeItem[];
  weeklyRisks: WeeklyActivityNarrativeItem[];
  weeklyCompleted: WeeklyActivityNarrativeItem[];
  segmentBoards: Array<{ segment: string; totalAccounts: number; totalPos: number; activeCount: number; completedCount: number; items: PresentationCustomer[] }>;
  contactReport: {
    totals: { salesPhysical: number; salesOnline: number; salesPhone: number; salesEmail: number; technicalPhysical: number; technicalOnline: number; totalActivities: number; uniqueCustomers: number; targets: WeeklyContactTargets };
    owners: Array<{ owner: string; salesPhysical: number; salesOnline: number; salesPhone: number; salesEmail: number; technicalPhysical: number; technicalOnline: number; totalActivities: number; uniqueCustomers: number; targets: WeeklyContactTargets }>;
  };
  jiraTicketSummary: JiraWeeklyTicketSummary;
  customerDashboard: {
    total: number;
    portfolioTotal: number;
    sectors: number;
    accountCount: number;
    activeDiscussedCustomers: number;
    kunyeComplete: number;
    kunyeMissing: number;
    kunyeNone: number;
    completionRate: number;
    kasaBreakdown: Array<{ label: string; value: number }>;
    topSectors: Array<{ label: string; value: number }>;
    ownerBars: Array<{ label: string; value: number }>;
    phaseBuckets: Array<{ key: string; label: string; range: string; value: number }>;
  };
  narrative: {
    title: string;
    dateRangeLabel: string;
    executiveSummary: string[];
    segmentSummaries: Array<{ title: string; bullets: string[] }>;
    riskSummary: string[];
  };
  customers: PresentationCustomer[];
  activities: ActivityRow[];
  phaseDefinitions: Array<{ phase_no: number; phase_name: string }>;
};

type BaseCustomerRow = {
  musteri_id: string | null;
  musteri: string | null;
  sorumlu: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  sektor: string | null;
  entegrasyon_tipi: string | null;
};

function emptyJiraWeeklyTicketSummary(from: string, to: string): JiraWeeklyTicketSummary {
  return {
    enabled: false,
    from,
    to,
    totalCreated: 0,
    totalClosed: 0,
    totalOngoing: 0,
    totalDevelopmentWaiting: 0,
    totalCustomerWaiting: 0,
    total: 0,
    rows: [],
    debug: {
      connected: false,
      issueCount: 0,
      companyFieldId: 'customfield_10002',
      queryMode: 'created-updated-range',
      sampleIssues: [],
    },
  };
}

export async function buildWeeklyManagementPresentation(admin: any, options?: { from?: string; to?: string; owner?: string; segment?: string; sellerMode?: boolean }) {
  const from = String(options?.from ?? '').trim() || toDateInput(startOfWeek(new Date()));
  const to = String(options?.to ?? '').trim() || toDateInput(endOfWeek(new Date()));
  const selectedOwner = String(options?.owner ?? '').trim();
  const selectedSegment = String(options?.segment ?? '').trim();
  const sellerMode = Boolean(options?.sellerMode);
  const selectedOwnerNorm = normalizeForSearch(selectedOwner);
  const selectedOwnerIsBusinessPartnerGroup = ['is ortakları', 'is ortaklari', 'is ortağı', 'is ortagi'].includes(normalizeDashboardKey(selectedOwner));

  const customers = await fetchAllRows<BaseCustomerRow>((rangeFrom, rangeTo) => {
    return admin
      .from('vw_crm_musteriler')
      .select('musteri_id,musteri,sorumlu,aktif_faz_no,aktif_faz_adi,sektor,entegrasyon_tipi')
      .order('musteri', { ascending: true })
      .range(rangeFrom, rangeTo);
  });

  const phaseDefinitions = (await fetchAllRows<any>((rangeFrom, rangeTo) => {
    return admin
      .from('faz_tanimlari')
      .select('faz_no,asama_adi')
      .order('faz_no', { ascending: true })
      .range(rangeFrom, rangeTo);
  }))
    .map((row: any) => ({
      phase_no: row?.faz_no == null ? null : Number(row.faz_no),
      phase_name: cleanText(row?.asama_adi, ''),
    }))
    .filter((row: { phase_no: number | null; phase_name: string }) => row.phase_no != null && row.phase_name) as Array<{ phase_no: number; phase_name: string }>;

  const phaseNameMap = new Map<number, string>(phaseDefinitions.map((row) => [row.phase_no, row.phase_name]));

  const normalizedCustomers = (customers ?? []).map((row) => {
    const customer = cleanText(row.musteri);
    const rawOwner = cleanText(row.sorumlu);
    const sector = cleanText(row.sektor);
    return {
      musteri_id: cleanText(row.musteri_id, ''),
      customer,
      owner: sellerMode ? (sellerPresentationOwnerLabel({ customer, owner: rawOwner, sector }) || rawOwner) : rawOwner,
      raw_owner: rawOwner,
      phase_no: row.aktif_faz_no == null ? null : Number(row.aktif_faz_no),
      phase_name: (row.aktif_faz_no == null ? null : phaseNameMap.get(Number(row.aktif_faz_no))) || String(row.aktif_faz_adi ?? '').trim() || null,
      sector,
      entegrasyon_tipi: cleanText(row.entegrasyon_tipi),
    };
  }).filter((row) => row.musteri_id);

  const reportOnlyCustomerIds = new Set(normalizedCustomers.filter((row) => isReportOnlyCustomer({ musteri: row.customer, sorumlu: row.owner, sektor: row.sector })).map((row) => row.musteri_id));
  // Yönetim sunumunda rapor-harici kayıt kuralı korunur; Satışçı Sunumu tarafında ise
  // İş Ortakları / özel portföy kayıtları da filtre seçeneklerine ve rapora dahil edilir.
  const normalPresentationCustomerRows = sellerMode ? normalizedCustomers : normalizedCustomers.filter((row) => !reportOnlyCustomerIds.has(row.musteri_id));
  const customerIds = normalizedCustomers.map((row) => row.musteri_id);
  const [kunyeRows, quotes, activities, allActivitiesRaw] = await Promise.all([
    loadKunyeRows(admin, customerIds),
    customerIds.length
      ? fetchAllByCustomerIds<any>(admin, 'quotes', 'id,quote_no,customer_id,status,closed_reason,total_amount,total_device_count,probability,created_at', customerIds, undefined, { idColumn: 'customer_id' })
      : [],
    fetchAllRows<any>((rangeFrom, rangeTo) => {
      return admin
        .from('pipeline_eventleri')
        .select('id,musteri_id,faz_no,durum,event_type,aksiyon,owner,partner_owner,notlar,created_at,created_by,activity_scope,affects_phase,is_blocked,blocked_note,musteriler(musteri,sorumlu,sektor,entegrasyon_tipi)')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo);
    }),
    customerIds.length
      ? fetchAllRows<any>((rangeFrom, rangeTo) => {
        return admin
          .from('pipeline_eventleri')
          .select('id,musteri_id,faz_no,durum,event_type,aksiyon,owner,partner_owner,notlar,created_at,created_by,activity_scope,affects_phase,is_blocked,blocked_note,musteriler(musteri,sorumlu,sektor,entegrasyon_tipi)')
          .order('created_at', { ascending: false })
          .range(rangeFrom, rangeTo);
      })
      : [],
  ]);

  const quoteIds = (quotes ?? []).map((row: any) => String(row?.id ?? '').trim()).filter(Boolean);
  const jiraEnabled = !sellerMode
    && await getSystemParameterBoolean('system_jira_enabled', true)
    && await getSystemParameterBoolean('system_jira_weekly_pptx_enabled', true);

  const [quoteItems, jiraTicketSummary] = await Promise.all([
    loadQuoteItemRows(admin, quoteIds),
    jiraEnabled ? buildJiraWeeklyTicketSummary(from, to) : Promise.resolve(emptyJiraWeeklyTicketSummary(from, to)),
  ]);

  const quoteCustomerMap = new Map<string, string>();
  for (const row of quotes ?? []) {
    const quoteId = String((row as any).id ?? '').trim();
    const customerId = String((row as any).customer_id ?? '').trim();
    if (quoteId && customerId) quoteCustomerMap.set(quoteId, customerId);
  }

  const quoteDeviceMap = new Map<string, Map<string, number>>();
  for (const row of quoteItems ?? []) {
    const quoteId = String((row as any).quote_id ?? '').trim();
    const customerId = quoteCustomerMap.get(quoteId);
    if (!customerId) continue;

    const productType = normalizeForSearch((row as any).product_type);
    const isRecurring = Boolean((row as any).is_recurring) || productType === 'recurring';
    if (isRecurring) continue;

    const label = cleanText((row as any).product_name_snapshot ?? (row as any).product_code_snapshot, 'Cihaz');
    const quantity = Number((row as any).quantity ?? 0) || 0;
    if (quantity <= 0) continue;

    const customerDevices = quoteDeviceMap.get(customerId) ?? new Map<string, number>();
    customerDevices.set(label, (customerDevices.get(label) ?? 0) + quantity);
    quoteDeviceMap.set(customerId, customerDevices);
  }

  const kunyeMap = new Map<string, any>();
  for (const row of kunyeRows) {
    const key = String((row as any).musteri_id ?? '').trim();
    if (key) kunyeMap.set(key, row);
  }

  const quoteMap = new Map<string, { count: number; totalAmount: number; quoteNumbers: string[] }>();
  for (const row of quotes) {
    const key = String((row as any).customer_id ?? '').trim();
    if (!key) continue;
    const item = quoteMap.get(key) ?? { count: 0, totalAmount: 0, quoteNumbers: [] };
    item.count += 1;
    item.totalAmount += Number((row as any).total_amount ?? 0) || 0;
    const quoteNo = cleanText((row as any).quote_no, '');
    if (quoteNo && !item.quoteNumbers.includes(quoteNo)) item.quoteNumbers.push(quoteNo);
    quoteMap.set(key, item);
  }

  let presentationCustomers: PresentationCustomer[] = normalPresentationCustomerRows.map((row) => {
    const rawKunye = kunyeMap.get(row.musteri_id) ?? null;
    const mapped = rawKunye ? mapKunyeDbToUi(rawKunye) : null;
    const kunyeStatus = getKunyeStatus({ ...(mapped ?? {}), ...(rawKunye ?? {}), firma_adi: row.customer, has_kunye_record: Boolean(rawKunye) });
    const quoteSummary = quoteMap.get(row.musteri_id) ?? { count: 0, totalAmount: 0, quoteNumbers: [] };
    const quoteDeviceItems = Array.from((quoteDeviceMap.get(row.musteri_id) ?? new Map<string, number>()).entries())
      .map(([label, quantity]) => ({ label, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label, 'tr'));
    const quoteDeviceTotal = quoteDeviceItems.reduce((total, item) => total + item.quantity, 0);

    const kasaposFirmasi = pickDistributionLabel(
      mapped?.kasapos_firmasi,
      rawKunye?.kasapos_firmasi,
      rawKunye?.sabit_kasa_yazilimi,
    );

    const posMarkasi = pickEftPosBrandForReport(rawKunye?.pos_markasi);
    const storeCountSource = mapped?.magaza_sayisi ?? rawKunye?.magaza_sayisi;

    return {
      musteri_id: row.musteri_id,
      customer: row.customer,
      owner: row.owner,
      sector: row.sector,
      entegrasyon_tipi: row.entegrasyon_tipi,
      phase_no: row.phase_no,
      phase_name: row.phase_name,
      phase_group: getCustomerPhaseMeta(row.phase_no).groupLabel,
      kasapos_firmasi: kasaposFirmasi || '-',
      sabit_bilgisayar_markasi: cleanText(mapped?.sabit_bilgisayar_markasi ?? rawKunye?.sabit_bilgisayar_markasi),
      pos_modeli: cleanText(mapped?.pos_modeli ?? rawKunye?.pos_modeli),
      pos_markasi: posMarkasi || '-',
      store_count: parseNumericValue(storeCountSource),
      store_count_text: cleanOptionalText(storeCountSource),
      pos_count: parseNumericValue(mapped?.toplam_pos_adedi ?? rawKunye?.toplam_pos_adedi),
      phase_status: '-',
      quote_count: quoteSummary.count,
      total_quote_amount: quoteSummary.totalAmount,
      quote_numbers: quoteSummary.quoteNumbers,
      quote_device_items: quoteDeviceItems,
      quote_device_summary: summarizeQuoteDeviceItems(quoteDeviceItems),
      quote_device_total: quoteDeviceTotal,
      latest_activity_date: '-',
      kunye_status: (kunyeStatus.status as 'Var' | 'Eksik' | 'Yok') ?? 'Yok',
    };
  });

  const ownerOptions = uniqueSorted(presentationCustomers.map((row) => row.owner));
  const segmentOptions = uniqueSorted(presentationCustomers.map((row) => detectSegment(row)));

  if (selectedOwner) presentationCustomers = presentationCustomers.filter((row) => row.owner === selectedOwner);
  if (selectedSegment) presentationCustomers = presentationCustomers.filter((row) => detectSegment(row) === selectedSegment);

  // Retail Genel Durum Raporu üst dashboardu, normal pipeline müşteri akışını bozmadan
  // tüm müşteri kaynağından hesaplanır. Böylece Cem Koç / Seda Kesikoğlu / İş Ortakları
  // portföy toplamı ve account sayısına dahil edilmez; ancak Account Yapısı panelinde
  // Havuz Account / Yemek Kartları / İş Ortakları kırılımları ayrıca görünür.
  let customerDashboardSource: PresentationCustomer[] = normalizedCustomers.map((row) => {
    const rawKunye = kunyeMap.get(row.musteri_id) ?? null;
    const mapped = rawKunye ? mapKunyeDbToUi(rawKunye) : null;
    const kunyeStatus = getKunyeStatus({ ...(mapped ?? {}), ...(rawKunye ?? {}), firma_adi: row.customer, has_kunye_record: Boolean(rawKunye) });
    const kasaposFirmasi = pickDistributionLabel(
      mapped?.kasapos_firmasi,
      rawKunye?.kasapos_firmasi,
      rawKunye?.sabit_kasa_yazilimi,
    );
    const posMarkasi = pickEftPosBrandForReport(rawKunye?.pos_markasi);

    return {
      musteri_id: row.musteri_id,
      customer: row.customer,
      owner: row.owner,
      sector: row.sector,
      entegrasyon_tipi: row.entegrasyon_tipi,
      phase_no: row.phase_no,
      phase_name: row.phase_name,
      phase_group: getCustomerPhaseMeta(row.phase_no).groupLabel,
      kasapos_firmasi: kasaposFirmasi || '-',
      sabit_bilgisayar_markasi: cleanText(mapped?.sabit_bilgisayar_markasi ?? rawKunye?.sabit_bilgisayar_markasi),
      pos_modeli: cleanText(mapped?.pos_modeli ?? rawKunye?.pos_modeli),
      pos_markasi: posMarkasi || '-',
      store_count: parseNumericValue(mapped?.magaza_sayisi ?? rawKunye?.magaza_sayisi),
      store_count_text: cleanOptionalText(mapped?.magaza_sayisi ?? rawKunye?.magaza_sayisi),
      pos_count: parseNumericValue(mapped?.toplam_pos_adedi ?? rawKunye?.toplam_pos_adedi),
      phase_status: '-',
      quote_count: 0,
      total_quote_amount: 0,
      quote_numbers: [],
      quote_device_items: [],
      quote_device_summary: '',
      quote_device_total: 0,
      latest_activity_date: '-',
      kunye_status: (kunyeStatus.status as 'Var' | 'Eksik' | 'Yok') ?? 'Yok',
    };
  });
  if (selectedOwner) customerDashboardSource = customerDashboardSource.filter((row) => row.owner === selectedOwner);
  if (selectedSegment) customerDashboardSource = customerDashboardSource.filter((row) => detectSegment(row) === selectedSegment);

  const visibleCustomerSet = new Set(presentationCustomers.map((row) => row.musteri_id));
  const activityCustomerFallbackMap = new Map(normalizedCustomers.map((row) => [row.musteri_id, {
    musteri_id: row.musteri_id,
    customer: row.customer,
    owner: row.owner,
    sector: row.sector,
    entegrasyon_tipi: row.entegrasyon_tipi,
  }]));
  const mapActivityRow = (row: any): ActivityRow => {
    const musteriId = String(row.musteri_id ?? '').trim();
    const fallbackCustomer = activityCustomerFallbackMap.get(musteriId);
    return {
    id: String(row.id ?? ''),
    musteri_id: musteriId,
    created_at: String(row.created_at ?? ''),
    created_by: cleanText(row.created_by ?? row.owner),
    responsible: cleanText(row?.musteriler?.sorumlu ?? fallbackCustomer?.owner),
    customer: cleanText(row?.musteriler?.musteri ?? fallbackCustomer?.customer),
    sector: cleanText(row?.musteriler?.sektor ?? fallbackCustomer?.sector),
    integration: cleanText(row?.musteriler?.entegrasyon_tipi ?? fallbackCustomer?.entegrasyon_tipi),
    phase: row.faz_no == null ? 'Fazsız' : `FAZ ${row.faz_no}`,
    phase_no: row.faz_no == null ? null : Number(row.faz_no),
    phase_name: row.faz_no == null ? null : (phaseNameMap.get(Number(row.faz_no)) ?? null),
    waiting: cleanText(row.partner_owner),
    status: cleanText(row.durum),
    notes: cleanText(row.notlar),
    activity_type: parseActivityType(row.aksiyon, row.event_type),
    raw_action: cleanText(row.aksiyon, ''),
    raw_event_type: cleanText(row.event_type, ''),
    affects_phase: typeof row.affects_phase === 'boolean' ? row.affects_phase : !isTechnicalChannelLike(parseActivityType(row.aksiyon, row.event_type)),
    activity_scope: cleanText(row.activity_scope, ''),
    is_blocked: Boolean(row.is_blocked),
    blocked_note: cleanText(row.blocked_note, ''),
    };
  };
  const activityBelongsToSelectedOwner = (row: any) => {
    if (!sellerMode || !selectedOwnerNorm) return true;

    // Satışçı sunumunda aktivitenin sahibi müşteri sorumlusu değil,
    // aktiviteyi gerçekten ekleyen kullanıcıdır.
    // Örnek: aktivite Seda'nın müşterisine girilmiş olsa bile created_by başka satışçıysa
    // kayıt Seda sunumunda değil, aktiviteyi giren satışçının sunumunda görünmelidir.
    const createdByNorm = normalizeForSearch(row?.created_by);
    return createdByNorm === selectedOwnerNorm;
  };

  const activityAllowedForPresentation = (row: any) => {
    const id = String(row.musteri_id ?? '').trim();
    const fallbackCustomer = activityCustomerFallbackMap.get(id);
    const kind = reportOnlyCustomerKind({ musteri: fallbackCustomer?.customer ?? row?.musteriler?.musteri, sorumlu: fallbackCustomer?.owner ?? row?.musteriler?.sorumlu, sektor: fallbackCustomer?.sector ?? row?.musteriler?.sektor });
    const isBusinessPartnerActivity = kind === 'business-partner';
    const isReportOnlyTechnical = reportOnlyCustomerIds.has(id) && isTechnicalChannelLike(parseActivityType(row.aksiyon, row.event_type));

    if (sellerMode && selectedOwnerNorm) {
      // Satışçı sunumunda aktivitenin sahibi müşteri sorumlusu değil,
      // aktiviteyi gerçekten ekleyen kullanıcıdır. İş ortağı aktiviteleri de
      // account tarafından girildiyse aynı rapora dahil edilir.
      if (selectedOwnerIsBusinessPartnerGroup && isBusinessPartnerActivity) return true;
      if (!activityBelongsToSelectedOwner(row)) return false;
      if (isBusinessPartnerActivity) return true;
      if (reportOnlyCustomerIds.has(id)) return isReportOnlyTechnical;
      return true;
    }

    if (visibleCustomerSet.has(id)) return true;
    if (isBusinessPartnerActivity) return true;
    return isReportOnlyTechnical;
  };

  const visibleActivities: ActivityRow[] = (activities ?? [])
    .filter(activityAllowedForPresentation)
    .map(mapActivityRow);
  const allActivities: ActivityRow[] = (allActivitiesRaw ?? [])
    .filter(activityAllowedForPresentation)
    .map(mapActivityRow);

  const latestActivitiesByCustomer = pickUniqueLatest(visibleActivities);
  const latestAllActivitiesByCustomer = pickUniqueLatest(allActivities);

  // Durum raporu tablolarındaki Tarih kolonu, tarih filtresinden bağımsız olarak
  // müşterinin raporda görünen fazındaki son aktivite tarihinden gelir.
  // Bu tablolar künye/full rapor mantığında çalıştığı için selected date range kullanılmaz.
  const latestAllActivityDateByCustomerAndPhase = new Map<string, string>();
  const latestAllActivityDateByCustomerId = new Map<string, string>();
  for (const row of allActivities) {
    if (!latestAllActivityDateByCustomerId.has(row.musteri_id)) latestAllActivityDateByCustomerId.set(row.musteri_id, row.created_at);
    const phaseKey = `${row.musteri_id}:${row.phase_no ?? ''}`;
    if (!latestAllActivityDateByCustomerAndPhase.has(phaseKey)) latestAllActivityDateByCustomerAndPhase.set(phaseKey, row.created_at);
  }

  const latestAllActivityByCustomerId = new Map(latestAllActivitiesByCustomer.map((row) => [row.musteri_id, row]));
  presentationCustomers = presentationCustomers
    .map((customer) => {
      const activity = latestAllActivityByCustomerId.get(customer.musteri_id);
      const effectivePhaseNo = activity?.phase_no ?? customer.phase_no;
      const phaseDate = latestAllActivityDateByCustomerAndPhase.get(`${customer.musteri_id}:${effectivePhaseNo ?? ''}`);
      const fallbackDate = latestAllActivityDateByCustomerId.get(customer.musteri_id);
      const latestActivityDate = phaseDate || fallbackDate || '-';
      const customerWithDate = {
        ...customer,
        latest_activity_date: latestActivityDate && latestActivityDate !== '-' ? toDateInput(new Date(latestActivityDate)) : '-',
      };
      if (!activity) return customerWithDate;
      return applyActivityPhaseToCustomer(
        { ...customerWithDate, phase_status: cleanText(activity.status, customer.phase_status || '-') },
        activity,
        phaseNameMap,
      );
    })
    .sort((a, b) => {
      const aMs = parseDateMs(a.latest_activity_date);
      const bMs = parseDateMs(b.latest_activity_date);
      const aHasDate = Number.isFinite(aMs);
      const bHasDate = Number.isFinite(bMs);

      // Account Müşterileri raporunda tüm müşteriler görünür kalır; sadece sıralama yapılır:
      // tarihi/aktivitesi olanlar bugünden geriye doğru DESC, tarihi olmayanlar en sonda.
      if (aHasDate && bHasDate) return bMs - aMs || a.customer.localeCompare(b.customer, 'tr');
      if (aHasDate) return -1;
      if (bHasDate) return 1;
      return a.customer.localeCompare(b.customer, 'tr');
    });
  // Yeni temas/ilk ziyaret hesabı planlanan Başlamadı kayıtlarını değil,
  // gerçekten girilmiş aktivite geçmişini baz alır.
  // Bu bölüm Yönetim Sunumu > İlerlemeler / İlk Temaslar / Tamamlananlar sayfasındaki
  // İlk Temaslar kolonunu besler. İstenen kural: seçilen tarih aralığında girilmiş
  // Yerinde Ziyaret aktivitelerinden Faz 2 / Faz 3 / Faz 4 olanların tamamı gelsin.
  // Bu yüzden sadece müşterinin sistemdeki ilk aktivitesine bakmıyoruz; aksi halde
  // daha önce aktivitesi olan ama bu hafta Faz 4 Yerinde Ziyaret girilen müşteriler
  // PPTX'e düşmüyordu.
  const weeklyNewContactRows = visibleActivities
    .filter((row) => normalizeActivityStatus(row.status) !== 'not_started')
    .filter((row) => isYerindeZiyaretActivity(row))
    .filter((row) => row.phase_no === 2 || row.phase_no === 3 || row.phase_no === 4);

  const weeklyNewContacts = pickUniqueLatestByCustomerPhase(weeklyNewContactRows)
    .sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at) || a.customer.localeCompare(b.customer, 'tr'))
    .map((row) => toNarrativeItem(row, row.notes || 'Faz 2 / Faz 3 / Faz 4 yerinde ziyaret aktivitesi girilen müşteri.'))
    .slice(0, 80);
  const newContactSet = new Set(weeklyNewContacts.map((row) => row.customer));
  const newContactIdSet = new Set(
    weeklyNewContactRows
      .map((row) => row.id)
      .filter(Boolean),
  );
  const phaseChangeFlags = buildPhaseChangeFlagMap(allActivities);
  const progressActivityRows = visibleActivities
    .filter((row) => normalizeActivityStatus(row.status) !== 'not_started')
    .filter((row) => !newContactIdSet.has(row.id))
    .filter((row) => isContactActivity(row))
    .sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at) || a.customer.localeCompare(b.customer, 'tr'));
  const technicalActivityRows = progressActivityRows.filter((row) => isTechnicalActivity(row));
  const nonTechnicalProgressRows = progressActivityRows.filter((row) => !isTechnicalActivity(row));

  const weeklyPhaseChangedProgress = pickUniqueLatestByCustomerPhase(
    nonTechnicalProgressRows.filter((row) => phaseChangeFlags.get(row.id) === true)
  )
    .map((row) => toNarrativeItem(row))
    .slice(0, 200);
  const weeklyPhaseUnchangedProgress = pickUniqueLatestByCustomerPhase(
    nonTechnicalProgressRows.filter((row) => phaseChangeFlags.get(row.id) !== true)
  )
    .map((row) => toNarrativeItem(row))
    .slice(0, 200);
  const weeklyTechnicalActivities = pickUniqueLatestByCustomerPhase(technicalActivityRows)
    .map((row) => toNarrativeItem(row))
    .slice(0, 200);

  const completedActivities = pickUniqueLatest(
    visibleActivities.filter((row) => detectCategoryFromText(`${row.status} ${row.notes}`) === 'completed')
  );
  const weeklyCompleted = completedActivities
    .map((row) => toNarrativeItem(row))
    .slice(0, 20);
  const completedSet = new Set(weeklyCompleted.map((row) => row.customer));

  // Ticari Riskler sayfası tarih aralığına bağlı değildir.
  // Aktivite dashboardında blokaj kaldırılmadığı sürece (is_blocked=true)
  // ilgili blokaj notu yönetim sunumunda görünmeye devam eder.
  // Bu nedenle burada visibleActivities değil, tüm aktivite geçmişi olan allActivities kullanılır.
  const activeBlockedLatest = pickUniqueLatest(
    allActivities.filter((row) => Boolean(row.is_blocked) && Boolean(cleanText(row.blocked_note, '')))
  );
  const weeklyRisks = activeBlockedLatest
    .map((row) => toNarrativeItem(row, row.blocked_note))
    .slice(0, 20);
  const riskSet = new Set(weeklyRisks.map((row) => row.customer));

  const highlightActivities = pickUniqueLatest(
    visibleActivities.filter((row) => {
      if (newContactSet.has(row.customer) || completedSet.has(row.customer) || riskSet.has(row.customer)) return false;
      const category = detectCategoryFromText(`${row.status} ${row.notes}`);
      return category === 'progress' || category === 'pilot';
    })
  );
  const weeklyHighlights = (highlightActivities.length > 0 ? highlightActivities : latestActivitiesByCustomer
    .filter((row) => !newContactSet.has(row.customer) && !completedSet.has(row.customer) && !riskSet.has(row.customer)))
    .map((row) => toNarrativeItem(row))
    .slice(0, 20);

  const phaseSummaryMap = new Map<string, { totalAccounts: number; totalPos: number }>();
  const eftBrandMap = new Map<string, number>();
  const kasaposMap = new Map<string, number>();
  let quoteCount = 0;
  let quoteAmount = 0;
  let kunyeComplete = 0;

  for (const row of presentationCustomers) {
    const phase = phaseBucket(row.phase_no);
    const phaseItem = phaseSummaryMap.get(phase.group) ?? { totalAccounts: 0, totalPos: 0 };
    phaseItem.totalAccounts += 1;
    phaseItem.totalPos += row.pos_count ?? 0;
    phaseSummaryMap.set(phase.group, phaseItem);
    const eftLabel = normalizeDistributionLabel(row.pos_markasi);
    const kasaposLabel = normalizeDistributionLabel(row.kasapos_firmasi);
    if (eftLabel) eftBrandMap.set(eftLabel, (eftBrandMap.get(eftLabel) ?? 0) + 1);
    if (kasaposLabel) kasaposMap.set(kasaposLabel, (kasaposMap.get(kasaposLabel) ?? 0) + 1);
    quoteCount += row.quote_count;
    quoteAmount += row.total_quote_amount;
    if (row.kunye_status === 'Var') kunyeComplete += 1;
  }

  const customerIdMap = new Map(presentationCustomers.map((row) => [row.musteri_id, row]));
  const pipelineAccounts = [...presentationCustomers]
    .filter((row) => row.kunye_status === 'Var')
    .sort(sortByPosThenName);

  const mapPhaseAccountsFromActivities = (
    source: ActivityRow[],
    status: 'active' | 'completed',
    options?: { sort?: 'pos' | 'latest' },
  ) => source
    .filter((row) => normalizeActivityStatus(row.status) === status)
    .map((activity) => {
      const customer = customerIdMap.get(activity.musteri_id);
      if (!customer) return null;
      return {
        ...applyActivityPhaseToCustomer(customer, activity, phaseNameMap),
        // Sağdaki yönetim tablosu için fazın en son kayıt/tamamlanma tarihini aktivite tarihinden taşır.
        latest_activity_date: activity.created_at ? toDateInput(new Date(activity.created_at)) : customer.latest_activity_date,
      };
    })
    .filter((row): row is PresentationCustomer => Boolean(row))
    .sort(options?.sort === 'latest'
      ? (a, b) => String(b.latest_activity_date || '').localeCompare(String(a.latest_activity_date || '')) || a.customer.localeCompare(b.customer, 'tr')
      : sortByPosThenName);

  // Sol taraftaki grafik ve özet sayıları seçilen tarih aralığındaki son aktivitelere göre kalır.
  const activePhaseAccounts = mapPhaseAccountsFromActivities(latestActivitiesByCustomer, 'active');
  const completedPhaseAccounts = mapPhaseAccountsFromActivities(latestActivitiesByCustomer, 'completed');

  // Faz grubu bazındaki grafikler ve sağdaki ilk 10 tablo tarih filtresinden bağımsız full raporu göstermelidir.
  const activePhaseChartAccounts = mapPhaseAccountsFromActivities(latestAllActivitiesByCustomer, 'active');
  const completedPhaseChartAccounts = mapPhaseAccountsFromActivities(latestAllActivitiesByCustomer, 'completed');

  const totalPosDevices = pipelineAccounts.reduce((sum, row) => sum + (row.pos_count ?? 0), 0);
  const activeProjects = activePhaseAccounts.length;
  const completedAccounts = completedPhaseAccounts.length;

  // KasaPos Pipeline Raporu, Müşteriler Dashboard üst alanıyla aynı mantığı kullanır:
  // vw_crm_musteriler + v_musteri_kunye_status birleşimi, seçili owner/segment filtresi sonrası hesaplanır.
  // Burada özellikle presentationCustomers kullanılmaz; çünkü aşağıda aktivite geçmişindeki son
  // event ile müşteri fazı rapor tabloları için değiştiriliyor. Dashboard ise aktif_faz_no
  // alanını baz alır ve tarih aralığına bağlı değildir.
  const dashboardRows = customerDashboardSource;
  const dashboardVisibleOwnerBars = buildRetailDashboardOwnerBars(dashboardRows);
  const dashboardAccountStructureRows = dashboardRows.filter(hasRetailDashboardAccount);
  const dashboardAccountStructureCustomerTotal = dashboardVisibleOwnerBars.reduce((sum, row) => sum + (Number(row.value) || 0), 0);

  // Portföy Büyüklüğü, Account Yapısı panelindeki müşteri adedinin toplamını gösterir.
  // Böylece Havuz Account / Yemek Kartları / İş Ortakları panelde yer aldığı gibi
  // portföy müşteri toplamına da yansır; Account KPI'sı ise sadece normal sorumlu adedini sayar.
  const dashboardPortfolioRows = dashboardAccountStructureRows;
  const dashboardSectorRows = dashboardPortfolioRows.filter((row) => !isRetailDashboardExcludedSector(row.sector));
  const dashboardTotalCustomers = dashboardAccountStructureCustomerTotal;
  const dashboardKunyeComplete = dashboardPortfolioRows.filter((row) => ['Var', 'Tamam'].includes(String(row.kunye_status))).length;
  const dashboardKunyeMissing = dashboardPortfolioRows.filter((row) => row.kunye_status === 'Eksik').length;
  const dashboardKunyeNone = dashboardPortfolioRows.filter((row) => row.kunye_status === 'Yok').length;
  const dashboardActiveDiscussedCustomers = dashboardPortfolioRows.filter((row) => row.phase_no != null && Number.isFinite(Number(row.phase_no))).length;
  const dashboardPhaseStats = summarizeDashboardValues(
    dashboardPortfolioRows.map((row) => row.phase_no != null && Number.isFinite(Number(row.phase_no)) ? `FAZ ${Number(row.phase_no)}` : 'Fazsız'),
    'Fazsız',
  );
  const customerDashboard = {
    total: dashboardTotalCustomers,
    portfolioTotal: dashboardAccountStructureCustomerTotal,
    sectors: countUniqueValues(dashboardSectorRows.map((row) => row.sector)),
    accountCount: countRetailDashboardFieldOwners(dashboardRows),
    activeDiscussedCustomers: dashboardActiveDiscussedCustomers,
    kunyeComplete: dashboardKunyeComplete,
    kunyeMissing: dashboardKunyeMissing,
    kunyeNone: dashboardKunyeNone,
    completionRate: dashboardTotalCustomers ? Math.round((dashboardKunyeComplete / Math.max(1, dashboardTotalCustomers)) * 100) : 0,
    kasaBreakdown: summarizeDashboardValues(dashboardPortfolioRows.map((row) => row.kasapos_firmasi), 'Tanımsız').slice(0, 4),
    topSectors: summarizeDashboardValues(dashboardSectorRows.map((row) => row.sector || '-'), '-'),
    ownerBars: dashboardVisibleOwnerBars,
    phaseBuckets: buildDashboardPhaseBucketsFromStats(dashboardPhaseStats),
  };

  // Sağdaki "Fazı Devam Eden Müşteriler" tablosu tarih filtresinden bağımsız
  // full müşteri/faz datasıyla beslendiği için alttaki toplam POS da aynı kaynaktan hesaplanır.
  // Böylece tabloda POS görünürken footer tarafında "0 POS cihazı" yazma hatası oluşmaz.
  const pipelinePosDevices = activePhaseChartAccounts
    .filter((row) => (row.pos_count ?? 0) > 0)
    .reduce((sum, row) => sum + (row.pos_count ?? 0), 0);
  const completedPosDevices = completedPhaseChartAccounts
    .filter((row) => (row.pos_count ?? 0) > 0)
    .reduce((sum, row) => sum + (row.pos_count ?? 0), 0);

  // Sağ taraftaki tablolar herhangi bir tarih filtresine bağlı değildir.
  // Yönetim sunumu için POS değeri müşteri künyesindeki Toplam POS Adedi alanından gelir.
  // 0 / boş POS kayıtları gösterilmez; tabloda en yüksek POS adedine sahip ilk 10 müşteri yer alır.
  const topActiveAccounts = mapPhaseAccountsFromActivities(latestAllActivitiesByCustomer, 'active', { sort: 'latest' })
    .filter((row) => (row.pos_count ?? 0) > 0)
    .slice(0, 10);
  const topCompletedAccounts = mapPhaseAccountsFromActivities(latestAllActivitiesByCustomer, 'completed', { sort: 'latest' })
    .filter((row) => (row.pos_count ?? 0) > 0)
    .slice(0, 10);

  const customerMap = new Map(presentationCustomers.map((row) => [row.customer, row]));
  const segmentBoards = ['Nebim', 'Toshiba', 'Encore / EnPOS / Logo / Dynamics'].map((segment) => {
    const items = latestActivitiesByCustomer
      .filter((row) => {
        const customer = customerMap.get(row.customer);
        return customer ? detectSegment(customer) === segment : false;
      })
      .map((row) => customerMap.get(row.customer)!)
      .sort(sortByPosThenName)
      .slice(0, 16);
    return {
      segment,
      totalAccounts: items.length,
      totalPos: items.reduce((sum, row) => sum + (row.pos_count ?? 0), 0),
      activeCount: items.filter((row) => phaseBucket(row.phase_no).isActive).length,
      completedCount: items.filter((row) => phaseBucket(row.phase_no).isCompleted).length,
      items,
    };
  });

  const contactTargetMap = await loadWeeklyContactTargetMap();
  const contactActivities = visibleActivities.filter(isContactActivity);
  type ContactKind = 'salesPhysical' | 'salesOnline' | 'salesPhone' | 'salesEmail' | 'technicalPhysical' | 'technicalOnline';
  type ContactOwnerAccumulator = {
    owner: string;
    salesPhysical: number;
    salesOnline: number;
    salesPhone: number;
    salesEmail: number;
    technicalPhysical: number;
    technicalOnline: number;
    uniqueCustomers: Set<string>;
  };
  const emptyContactOwner = (owner: string): ContactOwnerAccumulator => ({
    owner,
    salesPhysical: 0,
    salesOnline: 0,
    salesPhone: 0,
    salesEmail: 0,
    technicalPhysical: 0,
    technicalOnline: 0,
    uniqueCustomers: new Set<string>(),
  });
  const contactKinds: ContactKind[] = ['salesPhysical', 'salesOnline', 'salesPhone', 'salesEmail', 'technicalPhysical', 'technicalOnline'];
  const ownerContactMap = new Map<string, ContactOwnerAccumulator>();
  const relevantContactCustomerNames = new Set<string>();

  for (const row of contactActivities) {
    const kind = normalizeActivityKind(row.activity_type) as ContactKind | 'other';
    if (!contactKinds.includes(kind as ContactKind)) continue;
    const owner = cleanText(row.created_by || row.responsible, '-');
    const item = ownerContactMap.get(owner) ?? emptyContactOwner(owner);
    item[kind as ContactKind] += 1;
    item.uniqueCustomers.add(row.customer);
    relevantContactCustomerNames.add(row.customer);
    ownerContactMap.set(owner, item);
  }

  for (const [targetOwner, targets] of contactTargetMap.entries()) {
    if (selectedOwner && normalizeForSearch(targetOwner) !== selectedOwnerNorm) continue;
    if (!hasWeeklyContactTarget(targets)) continue;
    if (!ownerContactMap.has(targetOwner)) ownerContactMap.set(targetOwner, emptyContactOwner(targetOwner));
  }

  const totalSalesPhysical = contactActivities.filter((row) => normalizeActivityKind(row.activity_type) === 'salesPhysical').length;
  const totalSalesOnline = contactActivities.filter((row) => normalizeActivityKind(row.activity_type) === 'salesOnline').length;
  const totalSalesPhone = contactActivities.filter((row) => normalizeActivityKind(row.activity_type) === 'salesPhone').length;
  const totalSalesEmail = contactActivities.filter((row) => normalizeActivityKind(row.activity_type) === 'salesEmail').length;
  const totalTechnicalPhysical = contactActivities.filter((row) => normalizeActivityKind(row.activity_type) === 'technicalPhysical').length;
  const totalTechnicalOnline = contactActivities.filter((row) => normalizeActivityKind(row.activity_type) === 'technicalOnline').length;

  const ownerContactRows = Array.from(ownerContactMap.values())
      .map((row) => {
        const totalActivities = row.salesPhysical + row.salesOnline + row.salesPhone + row.salesEmail + row.technicalPhysical + row.technicalOnline;
        const targets = contactTargetMap.get(row.owner) ?? emptyWeeklyContactTargets();
        return {
          owner: row.owner,
          salesPhysical: row.salesPhysical,
          salesOnline: row.salesOnline,
          salesPhone: row.salesPhone,
          salesEmail: row.salesEmail,
          technicalPhysical: row.technicalPhysical,
          technicalOnline: row.technicalOnline,
          totalActivities,
          uniqueCustomers: row.uniqueCustomers.size,
          targets,
        };
      })
      .sort((a, b) => b.totalActivities - a.totalActivities || a.owner.localeCompare(b.owner, 'tr'));
  const totalTargets = ownerContactRows.reduce((acc, row) => addWeeklyContactTargets(acc, row.targets), emptyWeeklyContactTargets());

  const contactReport = {
    totals: {
      salesPhysical: totalSalesPhysical,
      salesOnline: totalSalesOnline,
      salesPhone: totalSalesPhone,
      salesEmail: totalSalesEmail,
      technicalPhysical: totalTechnicalPhysical,
      technicalOnline: totalTechnicalOnline,
      totalActivities: totalSalesPhysical + totalSalesOnline + totalSalesPhone + totalSalesEmail + totalTechnicalPhysical + totalTechnicalOnline,
      uniqueCustomers: relevantContactCustomerNames.size,
      targets: totalTargets,
    },
    owners: ownerContactRows,
  };

  const dateRangeLabel = `${from.split('-').reverse().join('.')} - ${to.split('-').reverse().join('.')}`;
  const narrative = {
    title: sellerMode && selectedOwner ? `${selectedOwner} Satışçı Sunumu ${dateRangeLabel}` : `PAX Türkiye CRM Haftalık Yönetim Sunumu ${dateRangeLabel}`,
    dateRangeLabel,
    executiveSummary: [
      `${pipelineAccounts.length} künye tamam müşteri içinde ${activeProjects} devam eden proje ve ${completedAccounts} tamamlanan proje görüntülendi.`,
      `KasaPos Pipeline Raporu için toplam ${totalPosDevices.toLocaleString('tr-TR')} POS cihaz verisi künye tamam müşterilerden toplandı; bunun ${pipelinePosDevices.toLocaleString('tr-TR')} adedi devam eden fazlarda, ${completedPosDevices.toLocaleString('tr-TR')} adedi tamamlanan fazlarda.`,
      `Seçili tarih aralığında ${visibleActivities.length} aktivite işlendi; ${new Set(visibleActivities.map((row) => row.created_by)).size} kişi sahada veya uzaktan temas gerçekleştirdi.`,
      `${weeklyNewContacts.length} müşteri bu hafta ilk kez temas edilen hesap olarak işaretlendi; ${weeklyRisks.length} blokaj / yönetim kararı notu sunuma taşındı.`,
    ],
    segmentSummaries: segmentBoards.map((board) => ({
      title: `${board.segment} kullanan firmalardaki durumlar`,
      bullets: [
        `${board.totalAccounts} haftalık aktif hesap ve ${board.totalPos.toLocaleString('tr-TR')} POS hacmi bu bölümde yer alıyor.`,
        `${board.activeCount} hesap aktif fazlarda, ${board.completedCount} hesap tamamlanan fazlarda bulunuyor.`,
        ...board.items.slice(0, 3).map((item) => `${item.customer}: ${item.phase_group} · ${item.pos_count ?? 0} POS · ${item.quote_count} teklif.`),
      ],
    })),
    riskSummary: weeklyRisks.slice(0, 5).map((row) => `${row.customer}: ${row.note}`),
  };

  return {
    filters: {
      from,
      to,
      ownerOptions,
      segmentOptions,
      selectedOwner,
      selectedSegment,
    },
    summary: {
      totalAccounts: pipelineAccounts.length,
      totalPosDevices,
      activeProjects,
      completedAccounts,
      pipelinePosDevices,
      completedPosDevices,
      weeklyActivities: visibleActivities.length,
      activePeople: new Set(visibleActivities.map((row) => row.created_by)).size,
      quoteCount,
      quoteAmount,
      kunyeCoveragePct: presentationCustomers.length ? Math.round((kunyeComplete / presentationCustomers.length) * 100) : 0,
    },
    phaseSummary: Array.from(phaseSummaryMap.entries())
      .map(([label, item]) => ({ label, ...item }))
      .sort((a, b) => b.totalPos - a.totalPos || b.totalAccounts - a.totalAccounts || a.label.localeCompare(b.label, 'tr')),
    eftPosBrandDistribution: summarizeMap(eftBrandMap).slice(0, 10),
    kasaposDistribution: summarizeMap(kasaposMap).slice(0, 10),
    topActiveAccounts,
    topCompletedAccounts,
    pipelineAccounts,
    activePhaseAccounts,
    completedPhaseAccounts,
    activePhaseChartAccounts,
    completedPhaseChartAccounts,
    weeklyHighlights,
    weeklyNewContacts,
    weeklyPhaseChangedProgress,
    weeklyPhaseUnchangedProgress,
    weeklyTechnicalActivities,
    weeklyRisks,
    weeklyCompleted,
    segmentBoards,
    contactReport,
    jiraTicketSummary,
    customerDashboard,
    narrative,
    customers: presentationCustomers,
    activities: visibleActivities,
    phaseDefinitions,
  } satisfies WeeklyManagementPresentationPayload;
}
