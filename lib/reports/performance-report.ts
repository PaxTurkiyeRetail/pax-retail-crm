import 'server-only';
import { db } from '@/lib/db';
import { activityLabelFromRow } from '@/lib/activities/presentation';
import { buildLiveBoard } from '@/lib/reports/live-board';
import { loadHunterFarmerActivity } from '@/lib/reports/inactive-customers';
import { LIVE_BOARD_RULES, istanbulDayKey, normalizeName, type LiveOwner } from '@/lib/reports/live-board-shared';
import { activityTargetKind } from '@/lib/reports/weekly-targets-shared';
import {
  DEFAULT_MEETINGS_PER_FIRM, INACTIVE_DAYS_BY_CATEGORY, LONG_POC_DAYS, MONTHS_SHORT, STALE_QUOTE_DAYS,
  perfRange, trendMonths,
  type Measure, type PerfOwnerReport, type PerfPayload, type PerfPeriodKind,
} from '@/lib/reports/performance-card';

/**
 * PERFORMANS KARNESİ — veri katmanı (Retail Sales Performance Report V1, 05.10.2026).
 *
 * İKİ KAYNAK:
 *   1) DÖNEME BAĞLI ölçüler (ciro, cihaz, görüşme, temas, fatura, kazanılan, çevirme, trend) burada
 *      tek seferlik toplu SQL'lerle seçilen döneme göre hesaplanır (N+1 yok).
 *   2) ANLIK DURUM ölçüleri (açık pipeline, forecast, portföy dağılımı, aktif POC, geciken aksiyon,
 *      entegrasyon/hizmet cihazı) Canlı Ekran'dan (`buildLiveBoard`) okunur — ikinci tanım yazılmaz.
 *
 * TANIMLAR:
 *   Ciro          : aktif satış kaydı (crm_sales, fatura) tutarı, satış tarihine göre. Satış kaydı
 *                   olmayan eski "kazanıldı" teklifleri sayılmaz (fatura değildir).
 *   Satılan cihaz : satış kalemlerinde sale_type ≠ rental cihaz adedi (+ kalemsiz satışın cihaz adedi).
 *                   Kiralama ayrı gösterilir; POC/konsinye satış kaydı değildir, zaten girmez.
 *   Görüşme       : yalnız fiziki + online satış görüşmesi (activityTargetKind), aktiviteyi GİREN kişiye.
 *   Satıcı ataması: satış/teklif kaydının kendi sahibi (owner_user_id, yoksa owner_name) — kayıt
 *                   anındaki sahip saklanır; müşteri devri geçmiş faturayı taşımaz.
 */

type Row = Record<string, any>;
const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);
const isMissing = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === '42883' || code === '42703';
};
const safe = <T,>(p: Promise<{ rows: T[] }>) => p.catch((error) => { if (isMissing(error)) return { rows: [] as T[] }; throw error; });

const Q_OWNERS = `
  select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
  from public.allowed_users u
`;

// Ciro + fatura adedi, ay bazında (dönem ve 6 aylık trend aynı satırlardan).
const Q_SALES = `
  select s.owner_user_id::text as owner_user_id, s.owner_name, to_char(s.sale_date, 'YYYY-MM') as month,
         count(*)::int as cnt, sum(s.amount)::float8 as amount
  from public.crm_sales s
  where s.status = 'active' and s.sale_date between $1::date and $2::date
  group by 1, 2, 3
`;

const Q_DEVICES = `
  select s.owner_user_id::text as owner_user_id, s.owner_name,
         case when i.sale_type = 'rental' then 'rental' else 'sale' end as kind,
         sum(i.quantity)::int as qty
  from public.crm_sales s
  join public.crm_sale_items i on i.sale_id = s.id
  where s.status = 'active' and s.sale_date between $1::date and $2::date
    and public.crm_sale_item_is_device(i.product_type, i.is_recurring)
  group by 1, 2, 3
  union all
  select s.owner_user_id::text, s.owner_name, 'sale', sum(s.device_count)::int
  from public.crm_sales s
  where s.status = 'active' and s.sale_date between $1::date and $2::date
    and not exists (select 1 from public.crm_sale_items i where i.sale_id = s.id)
  group by 1, 2
`;

const Q_WON = `
  select q.owner_user_id::text as owner_user_id, q.owner_name, q.customer_id::text as customer_id,
         count(*)::int as cnt,
         sum(case when s.id is not null and s.status <> 'cancelled' then s.amount else q.total_amount end)::float8 as amount
  from public.quotes q
  left join public.crm_sales s on s.quote_id = q.id
  where q.status = 'closed' and q.closed_reason = 'won'
    and (coalesce(q.closed_at, q.updated_at) at time zone 'Europe/Istanbul')::date between $1::date and $2::date
  group by 1, 2, 3
`;

// Açık teklif riskleri (anlık): 30+ gün dokunulmamış · geçerlilik (kapanış) tarihi geçmiş.
const Q_OPEN_QUOTE_RISKS = `
  select q.owner_user_id::text as owner_user_id, q.owner_name,
         count(*) filter (where (q.updated_at at time zone 'Europe/Istanbul')::date <= $1::date - $2::int)::int as stale,
         count(*) filter (where q.valid_until < $1::date)::int as overdue_close
  from public.quotes q
  where q.status = 'sent'
  group by 1, 2
`;

// 30+ gündür POC fazında bekleyen müşteri (anlık).
const Q_LONG_POC = `
  select m.owner_user_id::text as owner_user_id, m.sorumlu as owner_name, count(*)::int as cnt
  from public.musteriler m
  join public.musteri_pipeline mp on mp.musteri_id = m.id
  left join lateral (
    select min(pe.created_at)::date as started
    from public.pipeline_eventleri pe
    where pe.musteri_id = m.id and pe.faz_no = mp.aktif_faz_no
  ) fs on true
  where mp.aktif_faz_no = any($2::int[])
    and coalesce(mp.baslangic_tarihi::date, fs.started) <= $1::date - $3::int
  group by 1, 2
`;

const Q_MEETINGS = `
  select pe.aksiyon, pe.durum, pe.created_by, pe.musteri_id::text as musteri_id
  from public.pipeline_eventleri pe
  where coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date) between $1::date and $2::date
    and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
`;

// Account Atama çevirmeleri dönem içinde (H→F, L→H) — taşıma SONRASI kişiye sayılır.
const Q_CONVERSIONS = `
  select h.satici, h.owner_user_id::text as owner_user_id,
         count(*) filter (where h.from_kategori = 'H' and h.to_kategori = 'F')::int as h2f,
         count(*) filter (where h.from_kategori = 'L' and h.to_kategori = 'H')::int as l2h
  from public.crm_musteri_listesi_hareket h
  where (h.moved_at at time zone 'Europe/Istanbul')::date between $1::date and $2::date
  group by 1, 2
`;

const Q_TARGETS = `
  select tv.scope_type, tv.scope_user_id::text as user_id, td.code, tv.period_type,
         tv.period_start::text as period_start, tv.period_end::text as period_end, tv.target_value::float8 as value
  from public.crm_target_values tv
  join public.crm_target_definitions td on td.id = tv.definition_id
  where td.is_active = true and tv.target_value > 0 and tv.period_start <= $2::date and tv.period_end >= $1::date
`;

const Q_SNAPSHOT = `
  insert into public.crm_pipeline_snapshots (snapshot_month, owner_name, open_count, open_amount, weighted_amount, forecast_amount)
  select $1::date, x.owner, x.cnt, x.amount, x.weighted, x.forecast
  from unnest($2::text[], $3::int[], $4::numeric[], $5::numeric[], $6::numeric[]) as x(owner, cnt, amount, weighted, forecast)
  on conflict (snapshot_month, owner_name) do nothing
`;

export const TEAM_KEY = '__team__';

/** Bir ayın hedef payı: çeyrek kaydı varsa /3, yoksa yıl kaydı /12; hiç yoksa null. */
function monthShare(rows: Row[], month: string): number | null {
  const day = `${month}-15`;
  const hit = (type: string) => rows.find((r) => r.period_type === type && r.period_start <= day && r.period_end >= day);
  const quarter = hit('quarter');
  if (quarter) return num(quarter.value) / 3;
  const year = hit('year');
  if (year) return num(year.value) / 12;
  const monthRow = hit('month');
  return monthRow ? num(monthRow.value) : null;
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key >= end) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export async function buildPerformanceReport(options: { period: PerfPeriodKind; today?: Date }): Promise<PerfPayload> {
  const today = options.today ?? new Date();
  const todayKey = istanbulDayKey(today);
  const range = perfRange(options.period, todayKey);
  const trend = trendMonths(todayKey);
  const trendFrom = `${trend[0]}-01`;
  const salesFrom = trendFrom < range.from ? trendFrom : range.from;
  const periodMonths = monthsBetween(range.from, range.end);

  const [live, ownerRes, salesRes, deviceRes, wonRes, quoteRiskRes, pocRes, meetingRes, convRes, targetRes, listRows] = await Promise.all([
    buildLiveBoard({ today }),
    db.query(Q_OWNERS),
    db.query(Q_SALES, [salesFrom, todayKey]),
    safe(db.query(Q_DEVICES, [range.from, todayKey])),
    db.query(Q_WON, [range.from, todayKey]),
    db.query(Q_OPEN_QUOTE_RISKS, [todayKey, STALE_QUOTE_DAYS]),
    db.query(Q_LONG_POC, [todayKey, [...LIVE_BOARD_RULES.pocPhases], LONG_POC_DAYS]),
    db.query(Q_MEETINGS, [range.from, todayKey]),
    safe(db.query(Q_CONVERSIONS, [range.from, todayKey])),
    db.query(Q_TARGETS, [salesFrom < range.from ? salesFrom : range.from, range.end]),
    loadHunterFarmerActivity(today, ['L', 'H', 'F', 'K']),
  ]);

  const owners = live.owners;
  const ownerByKey = new Map(owners.map((o) => [normalizeName(o.owner), o.owner]));
  const nameById = new Map((ownerRes.rows as Row[]).map((r) => [String(r.id), String(r.name)]));
  const idByOwner = new Map<string, string>();
  for (const [id, name] of nameById) { const o = ownerByKey.get(normalizeName(name)); if (o && !idByOwner.has(o)) idByOwner.set(o, id); }
  /** Kayıt sahibi → rotasyondaki satıcı (önce kullanıcı id, sonra ad); bulunamazsa null (takımda sayılır). */
  const resolve = (userId: unknown, name: unknown): string | null => {
    const byId = userId ? nameById.get(String(userId)) : null;
    const hit = byId ? ownerByKey.get(normalizeName(byId)) : null;
    if (hit) return hit;
    return name ? ownerByKey.get(normalizeName(String(name))) ?? null : null;
  };

  type Acc = {
    revenue: number; invoices: number; amountByMonth: Map<string, number>; sold: number; rental: number;
    meetings: number; contacted: Set<string>; wonQuotes: number; wonAmount: number; wonCustomers: Set<string>;
    h2f: number; l2h: number; stale: number; overdueClose: number; longPoc: number;
  };
  const empty = (): Acc => ({
    revenue: 0, invoices: 0, amountByMonth: new Map(), sold: 0, rental: 0, meetings: 0, contacted: new Set(),
    wonQuotes: 0, wonAmount: 0, wonCustomers: new Set(), h2f: 0, l2h: 0, stale: 0, overdueClose: 0, longPoc: 0,
  });
  const accs = new Map<string, Acc>(owners.map((o) => [o.owner, empty()]));
  const team = empty();
  const each = (owner: string | null, fn: (a: Acc) => void, teamToo = true) => {
    if (teamToo) fn(team);
    if (owner && accs.has(owner)) fn(accs.get(owner)!);
  };
  const periodFromMonth = range.from.slice(0, 7);

  for (const r of salesRes.rows as Row[]) {
    const month = String(r.month);
    each(resolve(r.owner_user_id, r.owner_name), (a) => {
      a.amountByMonth.set(month, (a.amountByMonth.get(month) ?? 0) + num(r.amount));
      if (month >= periodFromMonth) { a.revenue += num(r.amount); a.invoices += num(r.cnt); }
    });
  }
  for (const r of deviceRes.rows as Row[]) {
    each(resolve(r.owner_user_id, r.owner_name), (a) => { if (r.kind === 'rental') a.rental += num(r.qty); else a.sold += num(r.qty); });
  }
  for (const r of wonRes.rows as Row[]) {
    each(resolve(r.owner_user_id, r.owner_name), (a) => {
      a.wonQuotes += num(r.cnt); a.wonAmount += num(r.amount);
      if (r.customer_id) a.wonCustomers.add(String(r.customer_id));
    });
  }
  for (const r of quoteRiskRes.rows as Row[]) {
    each(resolve(r.owner_user_id, r.owner_name), (a) => { a.stale += num(r.stale); a.overdueClose += num(r.overdue_close); });
  }
  for (const r of pocRes.rows as Row[]) each(resolve(r.owner_user_id, r.owner_name), (a) => { a.longPoc += num(r.cnt); });
  for (const r of meetingRes.rows as Row[]) {
    const kind = activityTargetKind(activityLabelFromRow(r));
    if (kind !== 'salesPhysical' && kind !== 'salesOnline') continue;
    each(resolve(null, r.created_by), (a) => { a.meetings += 1; if (r.musteri_id) a.contacted.add(String(r.musteri_id)); });
  }
  for (const r of convRes.rows as Row[]) each(resolve(r.owner_user_id, r.satici), (a) => { a.h2f += num(r.h2f); a.l2h += num(r.l2h); });

  // Hareketsiz firma: kategoriye göre eşik (L/H 15 · F/K 30). Künyeyle eşleşmeyen satır sayılmaz.
  const inactive = new Map<string, number>();
  let inactiveTeam = 0;
  const portfolio = new Map<string, { lead: number; hunter: number; farmer: number; kasa: number }>();
  const portfolioTeam = { lead: 0, hunter: 0, farmer: 0, kasa: 0 };
  const CAT_FIELD = { L: 'lead', H: 'hunter', F: 'farmer', K: 'kasa' } as const;
  for (const row of listRows) {
    const owner = resolve(row.ownerUserId, row.owner);
    const field = CAT_FIELD[row.category];
    portfolioTeam[field] += 1;
    if (owner) {
      const p = portfolio.get(owner) ?? { lead: 0, hunter: 0, farmer: 0, kasa: 0 };
      p[field] += 1;
      portfolio.set(owner, p);
    }
    if (!row.matched || (row.days != null && row.days < INACTIVE_DAYS_BY_CATEGORY[row.category])) continue;
    inactiveTeam += 1;
    if (owner) inactive.set(owner, (inactive.get(owner) ?? 0) + 1);
  }

  // Hedefler: kişi (user id) ve şirket satırları, kod bazında.
  const targetRows = targetRes.rows as Row[];
  const userTargets = (userId: string | undefined, code: string) => targetRows.filter((r) => r.scope_type === 'user' && r.user_id === userId && r.code === code);
  const companyTargets = (code: string) => targetRows.filter((r) => r.scope_type === 'company' && r.code === code);
  const sumMonths = (rows: Row[], months: string[]): number | null => {
    let total = 0;
    let any = false;
    for (const m of months) { const v = monthShare(rows, m); if (v != null) { total += v; any = true; } }
    return any ? Math.round(total) : null;
  };
  const periodTarget = (userId: string | undefined, code: string) => sumMonths(userTargets(userId, code), periodMonths);
  const teamTarget = (code: string): number | null => {
    const company = sumMonths(companyTargets(code), periodMonths);
    if (company != null) return company;
    const parts = owners.map((o) => periodTarget(idByOwner.get(o.owner), code)).filter((v): v is number => v != null);
    return parts.length ? parts.reduce((s, v) => s + v, 0) : null;
  };
  const perFirmTarget = (() => {
    const row = companyTargets('contacts_per_customer')[0];
    return row && num(row.value) > 0 ? num(row.value) : DEFAULT_MEETINGS_PER_FIRM;
  })();

  const build = (
    name: string, key: string, a: Acc, target: (code: string) => number | null,
    state: Pick<LiveOwner, 'revenue' | 'goals' | 'pipeline'> & { split: { lead: number; hunter: number; farmer: number; kasa: number }; listed: boolean; inactive: number; trendTarget: (month: string) => number | null },
  ): PerfOwnerReport => {
    const contacted = a.contacted.size;
    const total = state.split.lead + state.split.hunter + state.split.farmer + state.split.kasa;
    const g = state.goals;
    return {
      owner: name,
      key,
      revenue: { actual: a.revenue, target: target('sales_revenue') },
      devices: { actual: a.sold, target: target('device_count') },
      meetings: { actual: a.meetings, target: target('visit_count') },
      contacted,
      meetingsPerFirm: contacted ? { actual: Math.round((a.meetings / contacted) * 10) / 10, target: perFirmTarget } : null,
      invoices: { count: a.invoices, amount: a.revenue },
      won: { quotes: a.wonQuotes, amount: a.wonAmount, customers: a.wonCustomers.size, target: target('quotes_won_count') },
      hunterToFarmer: { actual: a.h2f, target: target('hunter_to_farmer') },
      leadToHunter: { actual: a.l2h, target: target('lead_to_hunter') },
      pipeline: { forecast: state.revenue.forecast, weighted: state.revenue.weightedPipeline, openCount: state.revenue.openQuotes, openAmount: state.revenue.pipeline },
      service: { activeDevices: g.integration.actual, target: g.integration.target, monthlyRevenue: g.integrationRevenue.usdMonth },
      rentalDevices: a.rental,
      portfolio: { total, ...state.split, listed: state.listed },
      activePoc: state.pipeline.poc,
      risks: { inactive: state.inactive, staleQuotes: a.stale, longPoc: a.longPoc, overdueActions: state.pipeline.overdueActions, overdueClose: a.overdueClose },
      trend: trend.map((m) => ({ month: m, label: MONTHS_SHORT[Number(m.slice(5, 7)) - 1], actual: Math.round(a.amountByMonth.get(m) ?? 0), target: state.trendTarget(m) })),
    };
  };

  const listed = listRows.length > 0;
  const ownerReports = owners.map((o) => {
    const userId = idByOwner.get(o.owner);
    return build(o.owner, normalizeName(o.owner), accs.get(o.owner)!, (code) => periodTarget(userId, code), {
      revenue: o.revenue, goals: o.goals, pipeline: o.pipeline,
      split: portfolio.get(o.owner) ?? { lead: 0, hunter: 0, farmer: 0, kasa: 0 },
      listed, inactive: inactive.get(o.owner) ?? 0,
      trendTarget: (m) => { const v = monthShare(userTargets(userId, 'sales_revenue'), m); return v == null ? null : Math.round(v); },
    });
  });
  const t = live.team;
  const sumGoal = (pick: (g: LiveOwner['goals']) => number | null) => owners.reduce((s, o) => s + (pick(o.goals) ?? 0), 0);
  const integrationTargets = owners.map((o) => o.goals.integration.target).filter((v): v is number => v != null);
  const teamReport = build('Ekip Özeti', TEAM_KEY, team, teamTarget, {
    revenue: t.revenue,
    goals: {
      ...owners[0]?.goals,
      integration: { actual: sumGoal((g) => g.integration.actual), target: integrationTargets.length ? integrationTargets.reduce((s, v) => s + v, 0) : null, pct: null },
      integrationRevenue: { usdMonth: sumGoal((g) => g.integrationRevenue.usdMonth), usdYear: 0, otherMonth: 0, otherYear: 0 },
    } as LiveOwner['goals'],
    pipeline: t.pipeline,
    split: portfolioTeam, listed, inactive: inactiveTeam,
    trendTarget: (m) => {
      const company = monthShare(companyTargets('sales_revenue'), m);
      if (company != null) return Math.round(company);
      const parts = owners.map((o) => monthShare(userTargets(idByOwner.get(o.owner), 'sales_revenue'), m)).filter((v): v is number => v != null);
      return parts.length ? Math.round(parts.reduce((s, v) => s + v, 0)) : null;
    },
  });

  // Aylık pipeline fotoğrafı (ileriye dönük geçmiş): ayın ilk açılışında yazılır, sonra dokunulmaz.
  const snapshotRows = [...ownerReports, teamReport];
  await safe(db.query(Q_SNAPSHOT, [
    `${todayKey.slice(0, 7)}-01`,
    snapshotRows.map((r) => r.key),
    snapshotRows.map((r) => r.pipeline.openCount),
    snapshotRows.map((r) => r.pipeline.openAmount),
    snapshotRows.map((r) => r.pipeline.weighted),
    snapshotRows.map((r) => r.pipeline.forecast),
  ]));

  const notes: string[] = [];
  if (!listed) notes.push('Account Atama listesi boş: portföy dağılımı ve hareketsiz firma N/A.');
  notes.push('Açık pipeline ve forecast anlık değerdir; geçmiş aylar için aylık fotoğraf 10.2026 itibarıyla birikmeye başladı.');

  return {
    generatedAt: new Date().toISOString(),
    range,
    owners: ownerReports,
    team: teamReport,
    notes,
  };
}

export type { Measure };
