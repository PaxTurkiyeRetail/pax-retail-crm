import 'server-only';
import { db } from '@/lib/db';
import { activityLabelFromRow, isDisplayableActivityRow } from '@/lib/activities/presentation';
import { buildSellerFollowupReport, type SellerFollowupRow } from '@/lib/reports/seller-followup';
import { buildWeeklyTargets } from '@/lib/reports/weekly-targets';
import {
  achievementPct,
  activityTargetKind,
  addWeeklyCounters,
  emptyWeeklyCounters,
  type WeeklyTargetCounters,
} from '@/lib/reports/weekly-targets-shared';
import {
  LIVE_BOARD_RULES as R,
  PHASE_GROUPS,
  dayDiff,
  dueTone,
  initialsOf,
  istanbulDayKey,
  paceTone,
  pctOf,
  phaseGroupOf,
  OWNER_ORDER,
  SECTOR_ORDER,
  orderDistribution,
  conversionPct,
  conversionTone,
  ownerOrderCompare,
  rankOwners,
  staleTone,
  weekRangeLabel,
  yearElapsedPct,
  type AlertItem,
  type Distribution,
  type Funnel,
  type HotItem,
  type LiveActivity,
  type LiveBoardPayload,
  type LiveOwner,
  type PipelineStats,
  type PocItem,
  type QuoteRow,
  type RevenueBlock,
  type Tone,
} from '@/lib/reports/live-board-shared';

// Canlı Ekran (Command Center) veri katmanı — TEK payload.
//
// Neden tek uç: TV gün boyu açık kalır, 5 dakikada bir yenilenir. Kişi başına
// ayrı istek yerine altı sorgu + iki mevcut rapor katmanı (haftalık hedefler,
// açık engeller) tek seferde kurulur; tüm KPI hesapları burada yapılır.
//
// Ciro tanımı: KAZANILAN TEKLİFLERİN tutarı (Teklif Raporları'ndaki wonRevenue
// ile aynı) — spec §13 "ikinci bir ciro tanımı üretilmemeli". Hedefler
// crm_target_values (sales_revenue / device_count, yıllık, kişi veya şirket).
// Potansiyel ciro (teklifsiz fırsat): forecast adedi × katalog liste fiyatı
// (kademeli fiyat kuralı) — ekranda "≈" ile tahmin olarak işaretlenir.
//
// Kişi seti: aktif ve `account_manager` rolündeki kullanıcılar (birincil ya da
// ikincil rol). Admin / ITSM / super_admin hesapları rotasyona girmez; onların
// aktiviteleri takım toplamlarına da katılmaz (yönetici talebi: Taha ve İshak
// dışında). Kullanıcı olmayan sorumlu adları (Havuz Account, İş Ortakları…)
// yalnız Portföy slaydında görünür.

type OwnerRow = { id: string; name: string };

type CustomerRow = {
  id: string;
  musteri: string;
  sorumlu: string | null;
  owner_user_id: string | null;
  sektor: string | null;
  customer_type: string | null;
  aktif_faz_no: number | null;
  faz_adi: string | null;
  faz_durum: string | null;
  baslangic: string | null;
  faz_baslangic: string | null;
  pipeline_hedef: string | null;
  last_activity_at: Date | string | null;
  last_aksiyon: string | null;
  last_durum: string | null;
  plan_date: string | null;
  plan_aksiyon: string | null;
  plan_not: string | null;
  plan_owner: string | null;
  plan_by: string | null;
  fc_qty: number | null;
  fc_value: number | null;
  fc_weighted: number | null;
  fc_models: string | null;
  fc_priced: boolean | null;
  kunye_status: string | null;
  kunye_required_filled: number | null;
  /** Hunter / Farmer (künye). Boşsa Hunter sayılır — yeni müşteri = Hunter (Çağdaş Bey, 07.09). */
  satici_etiketi: string | null;
};

type EventRow = {
  id: string;
  musteri_id: string;
  created_by: string | null;
  created_at: Date | string;
  /** Aktivitenin gerçekleştiği gün (YYYY-MM-DD). */
  activity_date: string;
  aksiyon: string | null;
  durum: string | null;
  faz_no: number | null;
  prev_faz: number | null;
  plan_faz: number | null;
  notlar: string | null;
  musteri: string | null;
  sorumlu: string | null;
};

type DbQuoteRow = {
  id: string;
  quote_no: string | null;
  customer_id: string | null;
  musteri: string | null;
  owner_name: string | null;
  status: string;
  closed_reason: string | null;
  probability: number | null;
  total_amount: number | null;
  total_device_count: number | null;
  proposal_date: string | null;
  valid_until: string | null;
  created_at: Date | string;
  closed_at: Date | string | null;
  updated_at: Date | string | null;
  /** crm_sales (satış kaydı) — teklif kazanıldıysa 1:1 eşlenir. */
  sale_id: string | null;
  sale_status: string | null;
  sale_amount: number | null;
  sale_device_count: number | null;
  sale_date: string | null;
};

type TargetRow = { scope_type: 'company' | 'user'; user_id: string | null; code: string; value: number };

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function text(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}
function dateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : istanbulDayKey(value);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && s.length <= 10) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : istanbulDayKey(d);
}
function isoOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function stripAksiyon(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  return raw.replace(/^AKTIVITE:/, '').trim() || null;
}
/** Hunter / Farmer: künye etiketi; boş = Hunter (yeni müşteri varsayılanı, Çağdaş Bey 07.09). */
function isFarmer(row: { satici_etiketi: string | null }) {
  return String(row.satici_etiketi ?? '').trim().toLocaleLowerCase('tr') === 'farmer';
}
function worstTone(...tones: Tone[]): Tone {
  const order: Tone[] = ['danger', 'warn', 'ok', 'info', 'neutral'];
  for (const t of order) if (tones.includes(t)) return t;
  return 'neutral';
}
function toDistribution(map: Map<string, number>, limit?: number, otherLabel = 'Diğer'): Distribution {
  const rows = Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
  if (!limit || rows.length <= limit) return rows;
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.value, 0);
  if (rest > 0) head.push({ label: otherLabel, value: rest });
  return head;
}

/* ------------------------------------------------------------------------ */
/* Sorgular                                                                  */
/* ------------------------------------------------------------------------ */

const Q_OWNERS = `
  select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
  from public.allowed_users u
  where u.is_active = true
    and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
  order by 2
`;

// Müşteri başına tek satır: faz, son gerçek hareket, bekleyen next action,
// forecast potansiyeli (liste fiyatıyla) ve künye durumu. Planlanan (Başlamadı +
// hedef tarihli) kayıtlar "hareket" sayılmaz; onlar next action'dır.
const Q_CUSTOMERS = `
  select m.id::text as id, m.musteri, m.sorumlu, m.owner_user_id::text as owner_user_id, m.sektor, m.customer_type,
         mp.aktif_faz_no, ft.asama_adi as faz_adi, mp.durum::text as faz_durum,
         mp.baslangic_tarihi::text as baslangic, fs.started::text as faz_baslangic, mp.hedef_tarihi::text as pipeline_hedef,
         la.activity_date::text as last_activity_at, la.aksiyon as last_aksiyon, la.durum::text as last_durum,
         pa.hedef_tarihi::text as plan_date, pa.aksiyon as plan_aksiyon, pa.notlar as plan_not, pa.owner as plan_owner, pa.created_by as plan_by,
         fc.qty as fc_qty, fc.value::float8 as fc_value, fc.weighted::float8 as fc_weighted, fc.models as fc_models, fc.priced as fc_priced,
         k.kunye_status, k.required_filled as kunye_required_filled,
         kv.satici_etiketi
  from public.musteriler m
  left join public.musteri_pipeline mp on mp.musteri_id = m.id
  left join public.musteri_kunye_v2 kv on kv.musteri_id = m.id
  left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
  left join public.v_musteri_kunye_status k on k.musteri_id = m.id
  left join lateral (
    -- Fazın başlangıcı: pipeline'da tarih yoksa o fazdaki ilk hareketin günü.
    select min(pe.created_at)::date as started
    from public.pipeline_eventleri pe
    where pe.musteri_id = m.id and pe.faz_no = mp.aktif_faz_no
  ) fs on true
  left join lateral (
    -- Son gerçek hareket: aktivite tarihine göre (geç girilen kayıt gerçek gününe sayılır).
    select pe.created_at, pe.aksiyon, pe.durum,
           coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date) as activity_date
    from public.pipeline_eventleri pe
    where pe.musteri_id = m.id
      and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
    order by coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date) desc, pe.created_at desc
    limit 1
  ) la on true
  left join lateral (
    -- Geçerli next action: son gerçek hareketten SONRA planlanmış olmalı. Daha
    -- eski bir plan, satıcı sonrasında aktivite girdiği için aşılmış sayılır
    -- (kapatılmamış eski planlar panoyu "149 gün gecikti" ile doldurmasın).
    select pe.hedef_tarihi, pe.aksiyon, pe.notlar, pe.owner, pe.created_by
    from public.pipeline_eventleri pe
    where pe.musteri_id = m.id and pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null
      and pe.created_at >= coalesce(la.created_at, '-infinity'::timestamptz)
    order by pe.created_at desc
    limit 1
  ) pa on true
  left join lateral (
    select sum(g.qty)::int as qty, sum(g.value) as value, sum(g.weighted) as weighted, bool_and(g.priced) as priced,
           string_agg(g.code || ': ' || g.qty, ', ' order by g.qty desc) as models
    from (
      select coalesce(nullif(trim(f.product_code_snapshot), ''), f.product_name_snapshot) as code,
             sum(f.quantity) as qty,
             sum(f.quantity * coalesce(pr.unit_price, 0)) as value,
             sum(f.quantity * coalesce(pr.unit_price, 0) * f.probability / 100.0) as weighted,
             bool_and(pr.unit_price is not null) as priced
      from public.crm_forecasts f
      left join lateral (
        select r.unit_price
        from public.quote_products p
        join public.quote_pricing_rules r on r.product_id = p.id
        where upper(p.code) = upper(coalesce(f.product_code_snapshot, ''))
        order by (r.min_qty <= f.quantity and (r.max_qty is null or r.max_qty >= f.quantity)) desc, r.min_qty desc
        limit 1
      ) pr on true
      where f.customer_id = m.id and f.is_active = true
      group by 1
    ) g
  ) fc on true
`;

// Haftanın gerçek hareketleri + faz bağlamı. prev_faz: müşterinin önceki gerçek
// hareketinin fazı; plan_faz: bu hareketle birlikte (aynı kayıt anında)
// planlanan sonraki aksiyonun fazı → "Faz 10 → 12 ↑" işareti buradan çıkar.
// Hafta filtresi AKTİVİTE TARİHİNE göre (07.09: geç girilen kayıt gerçek gününe sayılır);
// created_at kayıt zamanı olarak kalır → aktivite_tarihi < kayıt günü ise "geç girildi".
const Q_WEEK_EVENTS = `
  with actual as (
    select pe.id, pe.musteri_id, pe.created_by, pe.created_at, pe.aksiyon, pe.durum, pe.faz_no, pe.notlar, pe.hedef_tarihi,
           coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date) as activity_date,
           lag(pe.faz_no) over (partition by pe.musteri_id order by pe.created_at, pe.id) as prev_faz
    from public.pipeline_eventleri pe
    where not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
      and pe.musteri_id in (
        select w.musteri_id from public.pipeline_eventleri w
        where coalesce(w.aktivite_tarihi, (w.created_at at time zone 'Europe/Istanbul')::date) between $1::date and $2::date
      )
  )
  select a.id::text as id, a.musteri_id::text as musteri_id, a.created_by, a.created_at, a.activity_date::text as activity_date,
         a.aksiyon, a.durum::text as durum,
         a.faz_no, a.prev_faz, a.notlar, m.musteri, m.sorumlu, pl.faz_no as plan_faz
  from actual a
  left join public.musteriler m on m.id = a.musteri_id
  left join lateral (
    select max(p2.faz_no) as faz_no
    from public.pipeline_eventleri p2
    where p2.musteri_id = a.musteri_id and p2.durum = 'Başlamadı' and p2.hedef_tarihi is not null
      and p2.created_at >= a.created_at and p2.created_at < a.created_at + interval '15 seconds'
  ) pl on true
  where a.activity_date between $1::date and $2::date
  order by a.activity_date desc, a.created_at desc
`;

const Q_QUOTES = `
  select q.id::text as id, q.quote_no, q.customer_id::text as customer_id, m.musteri, q.owner_name, q.status, q.closed_reason,
         q.probability, q.total_amount::float8 as total_amount, q.total_device_count,
         q.proposal_date::text as proposal_date, q.valid_until::text as valid_until,
         q.created_at, q.updated_at, coalesce(q.closed_at, case when q.status = 'closed' then q.updated_at end) as closed_at,
         s.id::text as sale_id, s.status as sale_status, s.amount::float8 as sale_amount,
         s.device_count as sale_device_count, s.sale_date::text as sale_date
  from public.quotes q
  left join public.musteriler m on m.id = q.customer_id
  left join public.crm_sales s on s.quote_id = q.id
`;

const Q_TARGETS = `
  select tv.scope_type, tv.scope_user_id::text as user_id, td.code, tv.target_value::float8 as value
  from public.crm_target_values tv
  join public.crm_target_definitions td on td.id = tv.definition_id
  where td.is_active = true
    and tv.period_type = 'year'
    and tv.period_start <= $1::date and tv.period_end >= $1::date
    and td.code in ('sales_revenue', 'device_count', 'integration_count')
`;

// KasaPOS entegrasyonu: entegrasyon süreci açık tüm firmalar; faz ≥ 9 =
// entegrasyon tamamlandı (Entegrasyon Raporu'nun yeşil eşiği). Sorumlu bazında.
const Q_INTEGRATIONS = `
  select coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as owner,
         count(*)::int as total,
         count(*) filter (where mp.active_phase_no >= $1::int)::int as done
  from public.musteriler m
  left join public.organization_pipeline_states mp on mp.customer_id = m.id and mp.context_key='business_partner'
  where m.integration_enabled = true
  group by 1
`;

const Q_FORECAST_MONTHS = `
  select f.forecast_month as month, sum(f.quantity)::int as quantity, sum(f.quantity * f.probability / 100.0)::float8 as weighted
  from public.crm_forecasts f
  where f.is_active = true and f.forecast_year = $1
  group by 1
  order by 1
`;

const Q_FORECAST_OWNERS = `
  select coalesce(nullif(trim(f.owner_name), ''), '—') as owner, sum(f.quantity)::int as quantity
  from public.crm_forecasts f
  where f.is_active = true and f.forecast_year = $1
  group by 1
`;

/* ------------------------------------------------------------------------ */
/* Jira (opsiyonel) — önbellekli                                             */
/* ------------------------------------------------------------------------ */

type JiraSummary = Awaited<ReturnType<typeof import('@/lib/jira-weekly-tickets')['buildJiraWeeklyTicketSummary']>>;
const JIRA_TTL_MS = 10 * 60_000;
const JIRA_TIMEOUT_MS = 20_000;
const jiraCache: { key: string; at: number; value: JiraSummary | null; pending: Promise<JiraSummary | null> | null } = { key: '', at: 0, value: null, pending: null };

/**
 * Jira özeti pano yenilemesini bekletmesin: 10 dk önbellek; süresi geçmişse
 * yeni çağrı arka planda başlar, eldeki eski özet hemen döner (stale-while-revalidate).
 * Hiç özet yoksa en fazla 20 sn beklenir; sonra 'error' durumu.
 */
async function loadJiraSummary(from: string, to: string): Promise<JiraSummary | null> {
  const key = `${from}..${to}`;
  const fresh = jiraCache.key === key && Date.now() - jiraCache.at < JIRA_TTL_MS;
  if (fresh && jiraCache.value) return jiraCache.value;
  if (!jiraCache.pending) {
    jiraCache.pending = (async () => {
      try {
        const { buildJiraWeeklyTicketSummary } = await import('@/lib/jira-weekly-tickets');
        const value = await buildJiraWeeklyTicketSummary(from, to);
        jiraCache.key = key; jiraCache.at = Date.now(); jiraCache.value = value;
        return value;
      } catch {
        return null;
      } finally {
        jiraCache.pending = null;
      }
    })();
  }
  if (jiraCache.value && jiraCache.key === key) return jiraCache.value; // eski ama var: hemen dön
  return Promise.race([
    jiraCache.pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), JIRA_TIMEOUT_MS)),
  ]);
}

/* ------------------------------------------------------------------------ */
/* Ana kurucu                                                                */
/* ------------------------------------------------------------------------ */

export async function buildLiveBoard(options?: { today?: Date }): Promise<LiveBoardPayload> {
  const today = options?.today ?? new Date();
  const todayKey = istanbulDayKey(today);
  const year = Number(todayKey.slice(0, 4));
  const monthKey = todayKey.slice(0, 7);
  const elapsedPct = yearElapsedPct(todayKey);

  const [targets, followupReport] = await Promise.all([
    buildWeeklyTargets({ today }),
    buildSellerFollowupReport({ today }),
  ]);
  const { from, to } = targets.range;

  const [ownerResult, customerResult, eventResult, quoteResult, targetResult, forecastMonthResult, forecastOwnerResult, integrationResult] = await Promise.all([
    db.query(Q_OWNERS),
    db.query(Q_CUSTOMERS),
    db.query(Q_WEEK_EVENTS, [from, to]),
    db.query(Q_QUOTES),
    db.query(Q_TARGETS, [todayKey]),
    db.query(Q_FORECAST_MONTHS, [year]),
    db.query(Q_FORECAST_OWNERS, [year]),
    db.query(Q_INTEGRATIONS, [R.integrationDonePhase]),
  ]);
  const integrationByOwner = new Map<string, { total: number; done: number }>(
    (integrationResult.rows as any[]).map((row) => [String(row.owner), { total: num(row.total), done: num(row.done) }]),
  );
  const integrationTeam = Array.from(integrationByOwner.values()).reduce((acc, row) => ({ total: acc.total + row.total, done: acc.done + row.done }), { total: 0, done: 0 });

  const ownerRows = ownerResult.rows as OwnerRow[];
  const ownerNames = ownerRows.map((row) => row.name);
  const ownerSet = new Set(ownerNames);
  const ownerIdByName = new Map(ownerRows.map((row) => [row.name, row.id]));
  const ownerNameById = new Map(ownerRows.map((row) => [row.id, row.name]));

  const customers = customerResult.rows as CustomerRow[];
  const events = eventResult.rows as EventRow[];
  const quotes = quoteResult.rows as DbQuoteRow[];
  const targetRows = targetResult.rows as TargetRow[];

  /* --- Müşteri → sahip eşlemesi ------------------------------------------ */
  const ownerOfCustomer = (row: CustomerRow): string | null => {
    const byId = row.owner_user_id ? ownerNameById.get(row.owner_user_id) : null;
    if (byId) return byId;
    const name = text(row.sorumlu);
    return name && ownerSet.has(name) ? name : null;
  };

  /* --- Engeller (Takip Listesi kaynağı) ----------------------------------- */
  const blockerByCustomer = new Map<string, SellerFollowupRow>();
  for (const row of followupReport.rows) {
    // Aynı müşteride birden fazla açık engel varsa en yakın tarihli kalır.
    const existing = blockerByCustomer.get(row.customerId);
    if (!existing || (row.cozumTarihi ?? '9999') < (existing.cozumTarihi ?? '9999')) blockerByCustomer.set(row.customerId, row);
  }

  /* --- Teklifler ------------------------------------------------------------ */
  type QuoteAgg = {
    open: number; openAmount: number; weighted: number; weightedValid: number; expiredOpen: number;
    /** Pasif: açık ama geçerliliği bitmiş YA DA 30+ gün dokunulmamış (Çağdaş Bey, 07.09). */
    passiveOpen: number;
    wonYtd: number; wonYtdAmount: number; wonYtdDevices: number; wonMonth: number; wonMonthAmount: number;
    lostYtd: number; lostYtdAmount: number; weekCount: number; weekAmount: number; monthCount: number; monthAmount: number;
    /** Satış kaydı (crm_sales) tarafı: ciro ve cihaz artık buradan hesaplanır. */
    saleYtd: number; saleYtdAmount: number; saleYtdDevices: number; saleMonth: number; saleMonthAmount: number;
    saleCancelled: number;
  };
  const emptyQuoteAgg = (): QuoteAgg => ({
    open: 0, openAmount: 0, weighted: 0, weightedValid: 0, expiredOpen: 0, passiveOpen: 0,
    wonYtd: 0, wonYtdAmount: 0, wonYtdDevices: 0, wonMonth: 0, wonMonthAmount: 0,
    lostYtd: 0, lostYtdAmount: 0, weekCount: 0, weekAmount: 0, monthCount: 0, monthAmount: 0,
    saleYtd: 0, saleYtdAmount: 0, saleYtdDevices: 0, saleMonth: 0, saleMonthAmount: 0, saleCancelled: 0,
  });
  const quoteAggByOwner = new Map<string, QuoteAgg>();
  /** Bu hafta teklifi kazanılan müşteriler (sahip → müşteri id); huninin "Sipariş" adımı. */
  const wonWeekCustomersByOwner = new Map<string, Set<string>>();
  const openQuoteByCustomer = new Map<string, { amount: number; weighted: number }>();
  const openQuoteRows: QuoteRow[] = [];
  const closedQuoteRows: QuoteRow[] = [];
  const lostReasons = new Map<string, number>();
  const LOST = new Set(['lost', 'expired', 'no_interest']);
  const REASON_LABEL: Record<string, string> = { lost: 'Kaybedildi', expired: 'Süresi doldu', no_interest: 'İlgi yok' };

  for (const q of quotes) {
    const owner = text(q.owner_name) ?? '—';
    const amount = num(q.total_amount);
    const prob = num(q.probability);
    const createdKey = dateKey(q.created_at) ?? '';
    const closedKey = dateKey(q.closed_at);
    const agg = quoteAggByOwner.get(owner) ?? emptyQuoteAgg();
    const isOpen = q.status === 'sent';
    const isWon = q.status === 'closed' && q.closed_reason === 'won';
    const isLost = q.status === 'closed' && LOST.has(String(q.closed_reason ?? ''));
    const expired = Boolean(isOpen && q.valid_until && q.valid_until < todayKey);
    const touchedKey = dateKey(q.updated_at ?? q.created_at);
    const untouchedDays = touchedKey ? dayDiff(touchedKey, todayKey) ?? 0 : 0;
    const passive = isOpen && (expired || untouchedDays >= R.quotePassiveDays);

    if (createdKey >= from && createdKey <= to) { agg.weekCount += 1; agg.weekAmount += amount; }
    if (createdKey.slice(0, 7) === monthKey) { agg.monthCount += 1; agg.monthAmount += amount; }
    if (isOpen) {
      agg.open += 1; agg.openAmount += amount; agg.weighted += amount * prob / 100;
      if (expired) agg.expiredOpen += 1; else agg.weightedValid += amount * prob / 100;
      if (passive) agg.passiveOpen += 1;
      if (q.customer_id) {
        const cur = openQuoteByCustomer.get(q.customer_id) ?? { amount: 0, weighted: 0 };
        cur.amount += amount; cur.weighted += amount * prob / 100;
        openQuoteByCustomer.set(q.customer_id, cur);
      }
      openQuoteRows.push({
        quoteNo: text(q.quote_no) ?? '—', musteri: text(q.musteri) ?? '—', owner: text(q.owner_name), amount, devices: num(q.total_device_count),
        probability: prob, status: 'open', reason: null, date: q.valid_until ?? null, expired,
      });
    }
    if (isWon && closedKey && closedKey.slice(0, 4) === String(year)) {
      agg.wonYtd += 1; agg.wonYtdAmount += amount; agg.wonYtdDevices += num(q.total_device_count);
      if (closedKey.slice(0, 7) === monthKey) { agg.wonMonth += 1; agg.wonMonthAmount += amount; }
      // Ciro/cihaz artık satış kaydından (crm_sales) gelir; iptal edilen satış cirodan düşer.
      // Satış kaydı yoksa (eski veri) teklifin kendi tutarına düşülür.
      if (q.sale_id && q.sale_status === 'cancelled') {
        agg.saleCancelled += 1;
      } else {
        const saleKey = (q.sale_id ? dateKey(q.sale_date) : null) ?? closedKey;
        const saleAmount = q.sale_id ? num(q.sale_amount) : amount;
        const saleDevices = q.sale_id ? num(q.sale_device_count) : num(q.total_device_count);
        if (saleKey.slice(0, 4) === String(year)) {
          agg.saleYtd += 1; agg.saleYtdAmount += saleAmount; agg.saleYtdDevices += saleDevices;
          if (saleKey.slice(0, 7) === monthKey) { agg.saleMonth += 1; agg.saleMonthAmount += saleAmount; }
        }
      }
      if (closedKey >= from && closedKey <= to) {
        const set = wonWeekCustomersByOwner.get(owner) ?? new Set<string>();
        set.add(q.customer_id ?? q.id);
        wonWeekCustomersByOwner.set(owner, set);
      }
    }
    if (isLost && closedKey && closedKey.slice(0, 4) === String(year)) {
      agg.lostYtd += 1; agg.lostYtdAmount += amount;
      const label = REASON_LABEL[String(q.closed_reason)] ?? 'Diğer';
      lostReasons.set(label, (lostReasons.get(label) ?? 0) + 1);
    }
    if ((isWon || isLost) && closedKey) {
      // Kazanılan satırda satış kaydının güncel tutarı/cihazı gösterilir (teklif dondu, satış düzenlenebilir).
      const showAmount = isWon && q.sale_id && q.sale_status !== 'cancelled' ? num(q.sale_amount) : amount;
      const showDevices = isWon && q.sale_id && q.sale_status !== 'cancelled' ? num(q.sale_device_count) : num(q.total_device_count);
      closedQuoteRows.push({
        quoteNo: text(q.quote_no) ?? '—', musteri: text(q.musteri) ?? '—', owner: text(q.owner_name), amount: showAmount, devices: showDevices,
        probability: prob, status: isWon ? 'won' : 'lost', reason: isWon ? null : (REASON_LABEL[String(q.closed_reason)] ?? 'Diğer'), date: closedKey, expired: false,
        saleCancelled: isWon && q.sale_status === 'cancelled',
      });
    }
    quoteAggByOwner.set(owner, agg);
  }
  // Teklif listeleri de rotasyondaki satıcılarla sınırlı (test/yönetici teklifleri panoya girmez).
  const ownedQuote = (row: QuoteRow) => Boolean(row.owner && ownerSet.has(row.owner));
  const openQuotesShown = openQuoteRows.filter(ownedQuote).sort((a, b) => b.amount - a.amount);
  const closedQuotesShown = closedQuoteRows.filter(ownedQuote).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  /* --- Hedefler ------------------------------------------------------------ */
  type UserTargets = { revenue: number | null; devices: number | null; integrations: number | null };
  const emptyTargets = (): UserTargets => ({ revenue: null, devices: null, integrations: null });
  const targetByUser = new Map<string, UserTargets>();
  let companyRevenueTarget: number | null = null;
  let companyDeviceTarget: number | null = null;
  let companyIntegrationTarget: number | null = null;
  for (const row of targetRows) {
    const value = num(row.value) > 0 ? num(row.value) : null;
    if (row.scope_type === 'company') {
      if (row.code === 'sales_revenue') companyRevenueTarget = value;
      if (row.code === 'device_count') companyDeviceTarget = value;
      if (row.code === 'integration_count') companyIntegrationTarget = value;
      continue;
    }
    if (!row.user_id) continue;
    const cur = targetByUser.get(row.user_id) ?? emptyTargets();
    if (row.code === 'sales_revenue') cur.revenue = value;
    if (row.code === 'device_count') cur.devices = value;
    if (row.code === 'integration_count') cur.integrations = value;
    targetByUser.set(row.user_id, cur);
  }

  const revenueBlock = (
    agg: QuoteAgg,
    revenueTarget: number | null,
    deviceTarget: number | null,
    integration: { target: number | null; done: number; total: number },
  ): RevenueBlock => {
    const forecast = agg.saleYtdAmount + agg.weightedValid;
    const attainmentPct = pctOf(agg.saleYtdAmount, revenueTarget);
    return {
      year,
      target: revenueTarget,
      actualYtd: agg.saleYtdAmount,
      attainmentPct,
      remaining: revenueTarget == null ? null : Math.max(0, revenueTarget - agg.saleYtdAmount),
      forecast,
      forecastGap: revenueTarget == null ? null : forecast - revenueTarget,
      forecastPct: pctOf(forecast, revenueTarget),
      pipeline: agg.openAmount,
      weightedPipeline: agg.weighted,
      openQuotes: agg.open,
      expiredOpenQuotes: agg.expiredOpen,
      deviceTarget,
      deviceActualYtd: agg.saleYtdDevices,
      integrationTarget: integration.target,
      integrationDone: integration.done,
      integrationTotal: integration.total,
      wonYtd: { count: agg.wonYtd, amount: agg.wonYtdAmount },
      wonMonth: { count: agg.wonMonth, amount: agg.wonMonthAmount },
      lostYtd: { count: agg.lostYtd, amount: agg.lostYtdAmount },
      saleYtd: { count: agg.saleYtd, amount: agg.saleYtdAmount, devices: agg.saleYtdDevices },
      saleMonth: { count: agg.saleMonth, amount: agg.saleMonthAmount },
      saleCancelled: agg.saleCancelled,
      conversionPct: conversionPct(agg.saleYtd, agg.saleCancelled, agg.lostYtd),
      yearElapsedPct: elapsedPct,
      pace: paceTone(attainmentPct, elapsedPct),
    };
  };

  /* --- Haftanın hareketleri ---------------------------------------------- */
  const weekActivitiesByOwner = new Map<string, LiveActivity[]>();
  const todayByOwner = new Map<string, number>();
  const advancedByOwner = new Map<string, Set<string>>();
  const orderedByOwner = new Map<string, Set<string>>();
  for (const row of events) {
    const creator = text(row.created_by);
    if (!creator || !ownerSet.has(creator) || !isDisplayableActivityRow(row)) continue;
    const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;
    const label = activityLabelFromRow(row);
    const kind = activityTargetKind(label);
    const activityDay = String(row.activity_date ?? '').slice(0, 10) || istanbulDayKey(createdAt);
    const lateEntry = activityDay < istanbulDayKey(createdAt);
    if (activityDay === todayKey && kind !== 'other') {
      todayByOwner.set(creator, (todayByOwner.get(creator) ?? 0) + 1);
    }
    const phaseFrom = row.prev_faz == null ? null : Number(row.prev_faz);
    const phaseNow = row.faz_no == null ? null : Number(row.faz_no);
    const phaseTo = Math.max(phaseNow ?? 0, row.plan_faz == null ? 0 : Number(row.plan_faz)) || phaseNow;
    let phaseChange: LiveActivity['phaseChange'] = 'same';
    if (phaseFrom == null && phaseTo != null) phaseChange = 'first';
    else if (phaseFrom != null && phaseTo != null && phaseTo > phaseFrom) phaseChange = 'up';
    else if (phaseFrom != null && phaseTo != null && phaseTo < phaseFrom) phaseChange = 'down';

    if (phaseChange === 'up') {
      const set = advancedByOwner.get(creator) ?? new Set<string>();
      set.add(row.musteri_id);
      advancedByOwner.set(creator, set);
      if ((phaseFrom ?? 0) < R.orderPhase && (phaseTo ?? 0) >= R.orderPhase) {
        const orders = orderedByOwner.get(creator) ?? new Set<string>();
        orders.add(row.musteri_id);
        orderedByOwner.set(creator, orders);
      }
    }

    const list = weekActivitiesByOwner.get(creator) ?? [];
    if (list.length < R.recentActivities) {
      list.push({
        id: String(row.id),
        at: createdAt.toISOString(),
        date: activityDay,
        late: lateEntry,
        musteri: text(row.musteri) ?? '—',
        label: label === '-' ? 'Not' : label,
        kind,
        note: text(row.notlar),
        phaseFrom,
        phaseTo,
        phaseChange,
      });
      weekActivitiesByOwner.set(creator, list);
    }
  }

  /* --- Müşteri bazlı türetimler ------------------------------------------ */
  const customersByOwner = new Map<string, CustomerRow[]>();
  const portfolioByOwnerLabel = new Map<string, number>();
  const phaseGroupCounts = new Map<string, number>();
  const sectorCounts = new Map<string, number>();
  const kunyeCounts = new Map<string, number>([['Tamam', 0], ['Eksik', 0], ['Yok', 0]]);
  const farmerByOwnerLabel = new Map<string, number>();
  for (const row of customers) {
    const label = text(row.sorumlu) ?? 'Havuz Account';
    portfolioByOwnerLabel.set(label, (portfolioByOwnerLabel.get(label) ?? 0) + 1);
    if (isFarmer(row)) farmerByOwnerLabel.set(label, (farmerByOwnerLabel.get(label) ?? 0) + 1);
    const group = PHASE_GROUPS.find((g) => g.key === phaseGroupOf(row.aktif_faz_no));
    if (group) phaseGroupCounts.set(group.label, (phaseGroupCounts.get(group.label) ?? 0) + 1);
    if (row.customer_type !== 'business_partner') {
      const sector = text(row.sektor) && row.sektor !== '-' ? String(row.sektor).trim() : 'Sektör girilmemiş';
      sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
    }
    const kunyeLabel = row.kunye_status === 'dolu' ? 'Tamam' : num(row.kunye_required_filled) > 0 ? 'Eksik' : 'Yok';
    kunyeCounts.set(kunyeLabel, (kunyeCounts.get(kunyeLabel) ?? 0) + 1);
    const owner = ownerOfCustomer(row);
    if (owner) {
      const list = customersByOwner.get(owner) ?? [];
      list.push(row);
      customersByOwner.set(owner, list);
    }
  }

  const daysSince = (row: CustomerRow) => {
    const key = dateKey(row.last_activity_at);
    return key ? dayDiff(key, todayKey) : null;
  };
  const activeSince = (row: CustomerRow) => {
    const d = daysSince(row);
    return d != null && d <= 90;
  };
  const inPipeline = (row: CustomerRow) => row.aktif_faz_no != null && row.aktif_faz_no >= R.pipelinePhaseMin && row.aktif_faz_no <= R.pipelinePhaseMax;
  const isPoc = (row: CustomerRow) => row.aktif_faz_no != null && R.pocPhases.includes(row.aktif_faz_no);
  const isRollout = (row: CustomerRow) => row.aktif_faz_no === R.rolloutPhase;
  const notWonYet = (row: CustomerRow) => row.aktif_faz_no == null || row.aktif_faz_no < R.orderPhase;

  const nextActionOf = (row: CustomerRow) => {
    const blocker = blockerByCustomer.get(row.id);
    const planText = [stripAksiyon(row.plan_aksiyon), text(row.plan_not)].filter(Boolean).join(' · ') || null;
    if (row.plan_date) {
      return {
        nextAction: planText ?? 'Planlı aksiyon',
        // Faz sahibi kodu (SALES / PM + RS) TV'de anlamsız; planı giren kişi gösterilir.
        actionOwner: text(row.plan_by) ?? text(row.sorumlu),
        targetDate: row.plan_date,
        source: 'plan' as const,
      };
    }
    if (blocker) {
      return {
        nextAction: blocker.takipKonusu !== '—' ? blocker.takipKonusu : (blocker.notes ?? 'Engel takibi'),
        actionOwner: blocker.konuKimde !== '—' ? blocker.konuKimde : null,
        targetDate: blocker.cozumTarihi,
        source: 'blocker' as const,
      };
    }
    return { nextAction: planText, actionOwner: null, targetDate: row.pipeline_hedef, source: 'phase' as const };
  };

  const toHotItem = (row: CustomerRow): HotItem => {
    const blocker = blockerByCustomer.get(row.id);
    const next = nextActionOf(row);
    const quantity = num(row.fc_qty) || blocker?.totalQuantity || 0;
    const models = text(row.fc_models) ?? (blocker && blocker.modelAdetLabel !== '—' ? blocker.modelAdetLabel : '') ?? '';
    const openQuote = openQuoteByCustomer.get(row.id);
    const potentialValue = row.fc_priced ? num(row.fc_value) : 0;
    const weightedValue = openQuote ? openQuote.weighted : (row.fc_priced ? num(row.fc_weighted) : 0);
    const days = daysSince(row);
    const daysToTarget = next.targetDate ? dayDiff(todayKey, next.targetDate) : null;
    const tone = worstTone(dueTone(daysToTarget), staleTone(days) === 'danger' ? 'warn' : 'neutral');
    return {
      customerId: row.id,
      musteri: row.musteri,
      owner: text(row.sorumlu),
      phaseNo: row.aktif_faz_no,
      phaseName: text(row.faz_adi),
      phaseStatus: text(row.faz_durum),
      models,
      quantity,
      potentialValue,
      weightedValue,
      quoteAmount: openQuote?.amount ?? 0,
      lastActivityAt: isoOf(row.last_activity_at),
      lastActivityLabel: stripAksiyon(row.last_aksiyon),
      daysSinceActivity: days,
      nextAction: next.nextAction,
      actionOwner: next.actionOwner,
      targetDate: next.targetDate,
      daysToTarget,
      tone: tone === 'neutral' ? (blocker || next.source === 'plan' ? 'ok' : 'info') : tone,
      source: blocker && next.source !== 'plan' ? 'blocker' : next.source,
    };
  };
  // Hot Pipeline adayı (spec §8.1): teklif→sözleşme/rollout fazında OLAN ya da
  // değeri (teklif/forecast) OLAN ya da açık engeli OLAN kayıtlar. Yalnız
  // planı olan erken faz (lead) kayıtları hot değildir; onlar Uyarılar'a düşer.
  const hasValue = (row: CustomerRow) => num(row.fc_qty) > 0 || openQuoteByCustomer.has(row.id);
  const isHotCandidate = (row: CustomerRow) =>
    (notWonYet(row) || isRollout(row))
    && Boolean((row.aktif_faz_no != null && R.hotPhases.includes(row.aktif_faz_no)) || hasValue(row) || blockerByCustomer.has(row.id));
  // Sıra: önce yakın vadede aksiyon isteyenler (30 güne kadar gecikmiş ya da 14
  // gün içinde vadesi gelen), sonra değer. Aylar önce unutulmuş planlar en sona.
  const urgencyBucket = (item: HotItem) => {
    const d = item.daysToTarget;
    if (d == null) return 1;
    if (d < -30) return 2;
    if (d <= 14) return 0;
    return 1;
  };
  const valueOf = (item: HotItem) => item.weightedValue || item.quoteAmount || item.potentialValue || item.quantity;
  const hotSort = (a: HotItem, b: HotItem) =>
    urgencyBucket(a) - urgencyBucket(b)
    || valueOf(b) - valueOf(a)
    || (a.daysToTarget ?? 9999) - (b.daysToTarget ?? 9999)
    || a.musteri.localeCompare(b.musteri, 'tr');
  // Kişi slaydı (Çağdaş Bey, 04.09): "en yakın tarihli 5 fırsat" — hedef tarihi
  // en yakın olan önce (gecikmişler en başta), tarihi olmayanlar sona, eşitlikte değer.
  const ownerHotSort = (a: HotItem, b: HotItem) =>
    (a.daysToTarget ?? 9999) - (b.daysToTarget ?? 9999)
    || valueOf(b) - valueOf(a)
    || a.musteri.localeCompare(b.musteri, 'tr');

  const toPocItem = (row: CustomerRow): PocItem => {
    const next = nextActionOf(row);
    const days = daysSince(row);
    const daysToTarget = next.targetDate ? dayDiff(todayKey, next.targetDate) : null;
    const worst = worstTone(dueTone(daysToTarget), staleTone(days));
    return {
      customerId: row.id,
      musteri: row.musteri,
      owner: text(row.sorumlu),
      phaseNo: Number(row.aktif_faz_no),
      phaseName: text(row.faz_adi),
      phaseStatus: text(row.faz_durum),
      models: text(row.fc_models) ?? '',
      quantity: num(row.fc_qty),
      startDate: row.baslangic ?? row.faz_baslangic,
      lastActivityAt: isoOf(row.last_activity_at),
      daysSinceActivity: days,
      nextAction: next.nextAction,
      actionOwner: next.actionOwner,
      targetDate: next.targetDate,
      daysToTarget,
      // Mavi = aktif süreç (spec renk dili); sorun yoksa POC "devam ediyor" okunur.
      tone: worst === 'ok' || worst === 'neutral' ? 'info' : worst,
    };
  };

  const pipelineStats = (rows: CustomerRow[]): PipelineStats => {
    const stats: PipelineStats = {
      activeCustomers: 0, potentialDevices: 0, potentialValue: 0, weightedValue: 0,
      poc: 0, rollout: 0, stale: 0, staleCritical: 0, overdueActions: 0, plannedActions: 0,
    };
    for (const row of rows) {
      if (inPipeline(row)) {
        stats.activeCustomers += 1;
        const days = daysSince(row);
        if (days != null && days >= R.staleDangerDays) { stats.stale += 1; stats.staleCritical += 1; }
        else if (days != null && days >= R.staleWarnDays) stats.stale += 1;
      }
      if (notWonYet(row)) {
        stats.potentialDevices += num(row.fc_qty);
        if (row.fc_priced) { stats.potentialValue += num(row.fc_value); stats.weightedValue += num(row.fc_weighted); }
      }
      if (isPoc(row)) stats.poc += 1;
      if (isRollout(row)) stats.rollout += 1;
      if (row.plan_date) {
        stats.plannedActions += 1;
        if (row.plan_date < todayKey) stats.overdueActions += 1;
      }
      const blocker = blockerByCustomer.get(row.id);
      if (blocker?.overdue && !(row.plan_date && row.plan_date < todayKey)) stats.overdueActions += 1;
    }
    return stats;
  };

  /* --- Jira (opsiyonel) ---------------------------------------------------- */
  let jiraStatus: LiveBoardPayload['status']['jira'] = 'off';
  let jiraTeam: LiveBoardPayload['team']['jira'] = null;
  const jiraByCompany = new Map<string, { open: number; customerWaiting: number }>();
  if (String(process.env.JIRA_BASE_URL ?? '').trim()) {
    try {
      const summary = await loadJiraSummary(from, to);
      if (summary && summary.enabled !== false && !summary.warning) {
        jiraStatus = 'ok';
        const byCompany = summary.rows
          .map((row) => ({
            company: row.company || '—',
            ongoing: row.ongoing, developmentWaiting: row.developmentWaiting, customerWaiting: row.customerWaiting,
            created: row.created, closed: row.closed,
          }))
          .filter((row) => row.ongoing + row.developmentWaiting + row.customerWaiting + row.created + row.closed > 0)
          .sort((a, b) =>
            (b.ongoing + b.developmentWaiting + b.customerWaiting) - (a.ongoing + a.developmentWaiting + a.customerWaiting)
            || b.created - a.created
            || a.company.localeCompare(b.company, 'tr'));
        jiraTeam = {
          open: summary.totalOngoing + summary.totalDevelopmentWaiting + summary.totalCustomerWaiting,
          ongoing: summary.totalOngoing,
          created: summary.totalCreated,
          closed: summary.totalClosed,
          customerWaiting: summary.totalCustomerWaiting,
          developmentWaiting: summary.totalDevelopmentWaiting,
          byCompany,
        };
        for (const row of summary.rows) {
          jiraByCompany.set(row.company.toLocaleUpperCase('tr'), {
            open: row.ongoing + row.developmentWaiting + row.customerWaiting,
            customerWaiting: row.customerWaiting,
          });
        }
      } else {
        jiraStatus = 'error';
      }
    } catch {
      jiraStatus = 'error';
    }
  }

  /* --- Kişi slaytları ------------------------------------------------------ */
  const targetRowByOwner = new Map(targets.rows.map((row) => [row.owner, row]));
  const unranked = ownerNames.map((owner) => {
    const targetRow = targetRowByOwner.get(owner);
    const actual: WeeklyTargetCounters = targetRow?.actual ?? emptyWeeklyCounters();
    const target: WeeklyTargetCounters = targetRow?.target ?? emptyWeeklyCounters();
    const rows = customersByOwner.get(owner) ?? [];
    const agg = quoteAggByOwner.get(owner) ?? emptyQuoteAgg();
    const userTargets = targetByUser.get(ownerIdByName.get(owner) ?? '') ?? emptyTargets();
    const ownerIntegration = integrationByOwner.get(owner) ?? { total: 0, done: 0 };
    const hotAll = rows.filter(isHotCandidate).map(toHotItem).sort(ownerHotSort);
    const hot = hotAll.slice(0, R.hotOwnerLimit);
    let jira: LiveOwner['jira'] = null;
    if (jiraStatus === 'ok') {
      jira = { open: 0, customerWaiting: 0 };
      for (const row of rows) {
        const hit = jiraByCompany.get(row.musteri.toLocaleUpperCase('tr'));
        if (hit) { jira.open += hit.open; jira.customerWaiting += hit.customerWaiting; }
      }
    }
    // Sipariş adımı: bu hafta teklifi kazanılan YA DA Sipariş fazına geçen
    // müşteriler (aynı müşteri iki kez sayılmaz).
    const orderCustomers = new Set<string>([
      ...(wonWeekCustomersByOwner.get(owner) ?? []),
      ...(orderedByOwner.get(owner) ?? []),
    ]);
    const funnel: Funnel = {
      activities: actual.totalActivities,
      customers: actual.uniqueCustomers,
      advanced: advancedByOwner.get(owner)?.size ?? 0,
      quotes: agg.weekCount,
      orders: orderCustomers.size,
    };
    return {
      owner,
      initials: initialsOf(owner),
      portfolio: { total: rows.length, active: rows.filter(activeSince).length, farmer: rows.filter(isFarmer).length, hunter: rows.filter((row) => !isFarmer(row)).length },
      revenue: revenueBlock(agg, userTargets.revenue, userTargets.devices, { target: userTargets.integrations, ...ownerIntegration }),
      funnel,
      pipeline: pipelineStats(rows),
      actual,
      target,
      achievementPct: achievementPct(actual.totalActivities, target.totalActivities),
      todayActivities: todayByOwner.get(owner) ?? 0,
      quotes: { weekCount: agg.weekCount, weekAmount: agg.weekAmount, monthCount: agg.monthCount, monthAmount: agg.monthAmount },
      hot,
      hotTotal: hotAll.length,
      recentActivities: weekActivitiesByOwner.get(owner) ?? [],
      jira,
    };
  });
  // Portföyü, hedefi, teklifi ve bu hafta aktivitesi olmayan hesaplar boş slayt
  // üretmesin (yeni açılmış / pasif satıcı hesapları).
  // Sıra (rank) performansa göre hesaplanır; dönüş sırası ise sabit görüntüleme
  // sırası (OWNER_ORDER — Çağdaş Bey, 04.09). "Kim hedefinde" tablosu rank'a göre dizer.
  const owners: LiveOwner[] = rankOwners(unranked.filter((row) =>
    // (Haftalık hedef tek başına yetmez: 013 ile her account_manager'a varsayılan 20 yazıldı.)
    row.portfolio.total > 0
    || row.actual.totalActivities > 0
    || row.revenue.target != null
    || row.revenue.openQuotes > 0
    || row.revenue.wonYtd.count > 0)).sort((a, b) => ownerOrderCompare(a.owner, b.owner));

  /* --- Takım -------------------------------------------------------------- */
  const teamAgg = emptyQuoteAgg();
  for (const owner of ownerNames) {
    const agg = quoteAggByOwner.get(owner);
    if (!agg) continue;
    for (const key of Object.keys(teamAgg) as Array<keyof QuoteAgg>) teamAgg[key] += agg[key];
  }
  const ownerRevenueTargets = owners.map((row) => row.revenue.target).filter((v): v is number => v != null);
  const ownerDeviceTargets = owners.map((row) => row.revenue.deviceTarget).filter((v): v is number => v != null);
  const teamRevenueTarget = companyRevenueTarget ?? (ownerRevenueTargets.length ? ownerRevenueTargets.reduce((a, b) => a + b, 0) : null);
  const teamDeviceTarget = companyDeviceTarget ?? (ownerDeviceTargets.length ? ownerDeviceTargets.reduce((a, b) => a + b, 0) : null);
  const ownerIntegrationTargets = owners.map((row) => row.revenue.integrationTarget).filter((v): v is number => v != null);
  const teamIntegrationTarget = companyIntegrationTarget ?? (ownerIntegrationTargets.length ? ownerIntegrationTargets.reduce((a, b) => a + b, 0) : null);

  const teamActual = owners.reduce((acc, row) => addWeeklyCounters(acc, row.actual), emptyWeeklyCounters());
  const teamTarget = owners.reduce((acc, row) => addWeeklyCounters(acc, row.target), emptyWeeklyCounters());
  const teamCustomers = owners.flatMap((row) => customersByOwner.get(row.owner) ?? []);
  const teamFunnel: Funnel = owners.reduce(
    (acc, row) => ({
      activities: acc.activities + row.funnel.activities,
      customers: acc.customers + row.funnel.customers,
      advanced: acc.advanced + row.funnel.advanced,
      quotes: acc.quotes + row.funnel.quotes,
      orders: acc.orders + row.funnel.orders,
    }),
    { activities: 0, customers: 0, advanced: 0, quotes: 0, orders: 0 },
  );

  const teamHot = teamCustomers.filter(isHotCandidate).map(toHotItem).sort(hotSort).slice(0, R.hotTeamLimit);
  const pocRows = customers.filter((row) => isPoc(row) || isRollout(row)).map(toPocItem)
    .sort((a, b) => {
      const rank = (t: Tone) => (t === 'danger' ? 0 : t === 'warn' ? 1 : 2);
      return rank(a.tone) - rank(b.tone) || (a.daysToTarget ?? 9999) - (b.daysToTarget ?? 9999) || (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0);
    })
    .slice(0, R.pocLimit);

  /* --- Uyarılar ----------------------------------------------------------- */
  const alerts: AlertItem[] = [];
  for (const row of teamCustomers) {
    const owner = text(row.sorumlu);
    const days = daysSince(row);
    const blocker = blockerByCustomer.get(row.id);
    if (inPipeline(row) && days != null && days >= R.staleWarnDays) {
      alerts.push({
        kind: 'stale', title: row.musteri, owner, days,
        detail: `Faz ${row.aktif_faz_no}${row.faz_adi ? ` · ${row.faz_adi}` : ''} · ${days} gün hareket yok`,
        tone: staleTone(days),
      });
    }
    if (row.plan_date && row.plan_date < todayKey) {
      const late = dayDiff(row.plan_date, todayKey) ?? 0;
      alerts.push({
        kind: 'overdue', title: row.musteri, owner, days: late,
        detail: `${[stripAksiyon(row.plan_aksiyon), text(row.plan_not)].filter(Boolean).join(' · ') || 'Planlı aksiyon'} · ${late} gün gecikti`,
        tone: 'danger',
      });
    } else if (blocker?.overdue && blocker.cozumTarihi) {
      const late = dayDiff(blocker.cozumTarihi, todayKey) ?? 0;
      alerts.push({
        kind: 'overdue', title: row.musteri, owner, days: late,
        detail: `${blocker.takipKonusu} · ${late} gün gecikti`,
        tone: 'danger',
      });
    }
    if (isPoc(row)) {
      const next = nextActionOf(row);
      const d = next.targetDate ? dayDiff(todayKey, next.targetDate) : null;
      if (d != null && d < 0) {
        alerts.push({ kind: 'poc_delay', title: row.musteri, owner, days: -d, detail: `${row.faz_adi ?? `Faz ${row.aktif_faz_no}`} · hedef tarih ${-d} gün geçti`, tone: 'danger' });
      }
    }
    if (blocker && !blocker.overdue) {
      if (blocker.konuKimdeTipi === 'Müşteri') {
        alerts.push({ kind: 'customer_waiting', title: row.musteri, owner, days: days, detail: `${blocker.takipKonusu} · ${blocker.konuKimde}`, tone: 'warn' });
      }
    }
    if (row.aktif_faz_no === 14 && days != null && days >= R.staleWarnDays) {
      alerts.push({ kind: 'contract_waiting', title: row.musteri, owner, days, detail: `Sözleşme aşamasında ${days} gün bekliyor`, tone: staleTone(days) });
    }
  }
  for (const row of owners) {
    if (row.revenue.target != null && row.revenue.forecastGap != null && row.revenue.forecastGap < 0) {
      alerts.push({
        kind: 'target_gap', title: row.owner, owner: row.owner, days: null,
        detail: `Forecast hedefin ${Math.round(-row.revenue.forecastGap).toLocaleString('tr-TR')} $ altında (%${row.revenue.forecastPct ?? 0})`,
        tone: row.revenue.pace ?? 'warn',
      });
    }
    if (row.revenue.expiredOpenQuotes > 0) {
      alerts.push({
        kind: 'expired_quote', title: row.owner, owner: row.owner, days: null,
        detail: `${row.revenue.expiredOpenQuotes} açık teklifin geçerlilik süresi doldu, kapatılmadı`,
        tone: 'warn',
      });
    }
    // Portföy yükü (Çağdaş Bey, 07.09): "üzerinizde 50–60'dan fazla firma olmasın" —
    // fazlası havuza devredilmeli. İş ortağı kayıtları sayılmaz.
    if (row.portfolio.total >= R.portfolioLoadLimit) {
      alerts.push({
        kind: 'portfolio_load', title: row.owner, owner: row.owner, days: null,
        detail: `${row.portfolio.total} firma tek sorumluda (sınır ${R.portfolioLoadLimit}) · ${row.portfolio.total - row.portfolio.active} tanesi 90 gündür hareketsiz`,
        tone: row.portfolio.total >= R.portfolioLoadLimit * 1.25 ? 'danger' : 'warn',
      });
    }
  }
  const toneRank = (t: Tone) => (t === 'danger' ? 0 : t === 'warn' ? 1 : 2);
  alerts.sort((a, b) => toneRank(a.tone) - toneRank(b.tone) || (b.days ?? 0) - (a.days ?? 0) || a.title.localeCompare(b.title, 'tr'));
  const alertCounts: LiveBoardPayload['team']['alertCounts'] = {
    stale: 0, overdue: 0, target_gap: 0, poc_delay: 0, customer_waiting: 0, contract_waiting: 0, expired_quote: 0, portfolio_load: 0,
  };
  for (const alert of alerts) alertCounts[alert.kind] += 1;
  // Ekranda tür başına en fazla R.alertLimit satır: tek tür (ör. 36 stale) diğerlerini boğmasın.
  const perKind = new Map<AlertItem['kind'], number>();
  const shownAlerts = alerts.filter((alert) => {
    const n = perKind.get(alert.kind) ?? 0;
    if (n >= R.alertLimit) return false;
    perKind.set(alert.kind, n + 1);
    return true;
  });

  /* --- Forecast (adet, CRM forecast modülü) ------------------------------- */
  const forecastByMonth = (forecastMonthResult.rows as any[]).map((row) => ({
    month: Number(row.month), label: MONTHS_TR[Number(row.month) - 1] ?? String(row.month), quantity: num(row.quantity), weighted: Math.round(num(row.weighted)),
  }));
  const forecastByOwner: Distribution = (forecastOwnerResult.rows as any[])
    .map((row) => ({ label: String(row.owner), value: num(row.quantity) }))
    .sort((a, b) => b.value - a.value);

  const byOwnerQuotes = ownerNames.map((owner) => {
    const agg = quoteAggByOwner.get(owner) ?? emptyQuoteAgg();
    return {
      owner, open: agg.open, openAmount: agg.openAmount, weighted: agg.weighted, passive: agg.passiveOpen,
      monthCreated: agg.monthCount, monthAmount: agg.monthAmount,
      won: agg.wonYtd, wonAmount: agg.wonYtdAmount, lost: agg.lostYtd,
      sale: agg.saleYtd, saleAmount: agg.saleYtdAmount, saleDevices: agg.saleYtdDevices,
      saleCancelled: agg.saleCancelled,
      // Dönüşüm = satışa dönen / kapanan (satış + iptal + kayıp).
      conversionPct: conversionPct(agg.saleYtd, agg.saleCancelled, agg.lostYtd),
    };
  }).filter((row) => row.open || row.won || row.lost || row.monthCreated).sort((a, b) => ownerOrderCompare(a.owner, b.owner));

  // Dönüşüm oranı dağılımı: sadece kapanan teklifi olanlar (aksi halde "%0" yanıltır).
  const conversionByOwner: Distribution = byOwnerQuotes
    .filter((row) => row.conversionPct != null)
    .map((row) => ({
      label: row.owner,
      value: row.conversionPct ?? 0,
      hint: `${row.sale} satış · ${row.lost} kayıp${row.saleCancelled > 0 ? ` · ${row.saleCancelled} iptal` : ''}`,
      tone: conversionTone(row.conversionPct),
    }))
    .sort((a, b) => ownerOrderCompare(a.label, b.label));

  return {
    generatedAt: new Date().toISOString(),
    range: { from, to, label: weekRangeLabel(from, to), today: todayKey, year },
    status: { crm: 'ok', jira: jiraStatus },
    team: {
      ownerCount: owners.length,
      // Entegrasyon takım toplamı: tüm entegrasyon firmaları (sorumlusu rotasyon dışı olsa da — çoğu Taha'da).
      revenue: revenueBlock(teamAgg, teamRevenueTarget, teamDeviceTarget, { target: teamIntegrationTarget, ...integrationTeam }),
      funnel: teamFunnel,
      pipeline: pipelineStats(teamCustomers),
      actual: teamActual,
      target: teamTarget,
      achievementPct: achievementPct(teamActual.totalActivities, teamTarget.totalActivities),
      todayActivities: owners.reduce((sum, row) => sum + row.todayActivities, 0),
      quotes: { weekCount: teamAgg.weekCount, weekAmount: teamAgg.weekAmount, monthCount: teamAgg.monthCount, monthAmount: teamAgg.monthAmount },
      hot: teamHot,
      poc: pocRows,
      alerts: shownAlerts,
      alertCounts,
      jira: jiraTeam,
    },
    portfolio: {
      total: customers.length,
      // Sabit sıra (Çağdaş Bey, 04.09); sayfalama olduğu için "Diğer"e katlama yok —
      // Lojistik gibi küçük sektörler de görünür.
      byOwner: orderDistribution(toDistribution(portfolioByOwnerLabel), OWNER_ORDER).map((row) => {
        const farmer = farmerByOwnerLabel.get(row.label) ?? 0;
        return { ...row, split: farmer, hint: `${row.value - farmer} hunter · ${farmer} farmer` };
      }),
      hunterFarmer: [
        { label: 'Hunter', value: customers.filter((row) => !isFarmer(row)).length, hint: 'yeni müşteri kazanımı' },
        { label: 'Farmer', value: customers.filter(isFarmer).length, hint: 'mevcut portföyü büyütme' },
      ],
      byPhaseGroup: PHASE_GROUPS.map((g) => ({ label: g.label, value: phaseGroupCounts.get(g.label) ?? 0 })).filter((row) => row.value > 0),
      bySector: orderDistribution(toDistribution(sectorCounts), SECTOR_ORDER),
      kunye: [
        { label: 'Tamam', value: kunyeCounts.get('Tamam') ?? 0, tone: 'ok' },
        { label: 'Eksik', value: kunyeCounts.get('Eksik') ?? 0, tone: 'warn' },
        { label: 'Yok', value: kunyeCounts.get('Yok') ?? 0, tone: 'neutral' },
      ],
    },
    quotes: {
      open: openQuotesShown.slice(0, R.openQuotesLimit),
      recentClosed: closedQuotesShown.slice(0, R.closedQuotesLimit),
      byOwner: byOwnerQuotes,
      lostReasons: toDistribution(lostReasons),
      conversionByOwner,
      conversion: {
        pct: conversionPct(teamAgg.saleYtd, teamAgg.saleCancelled, teamAgg.lostYtd),
        sale: teamAgg.saleYtd, lost: teamAgg.lostYtd, cancelled: teamAgg.saleCancelled,
      },
    },
    forecast: {
      year,
      totalQuantity: forecastByMonth.reduce((sum, row) => sum + row.quantity, 0),
      weightedQuantity: forecastByMonth.reduce((sum, row) => sum + row.weighted, 0),
      byMonth: forecastByMonth,
      byOwner: forecastByOwner,
    },
    owners,
  };
}
