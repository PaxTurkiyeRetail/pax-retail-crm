import 'server-only';
import { db } from '@/lib/db';
import { activityLabelFromRow } from '@/lib/activities/presentation';
import { istanbulDayKey, normalizeName } from '@/lib/reports/live-board-shared';
import { activityTargetKind } from '@/lib/reports/weekly-targets-shared';
import { perfRange, type PerfPeriodKind } from '@/lib/reports/performance-card';
import type { PerfEvent, PerfEventsPayload } from '@/lib/reports/performance-activity-shared';

/**
 * PERFORMANS KARNESİ — HAREKET DÖKÜMÜ (05.10.2026, müdür: "buraya bakınca hangi veriye baktığını
 * karşıya göstermek"). Seçilen satıcının dönem içinde NE, NE KADAR, NE ZAMAN yaptığı tek listede:
 * aktiviteler (görüşme ayrı işaretli), gönderilen / kazanılan / kaybedilen teklifler, kesilen faturalar,
 * Account Atama kategori değişimleri. Yeni tablo yok; karnedeki sayaçlarla aynı kaynaklar okunur.
 * Satıcı eşleşmesi karneyle aynı: kayıt sahibi id → ad, yoksa ad (normalizeName).
 */

type Row = Record<string, any>;
const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);
const LIMIT = 3000;

const Q_ACTIVITIES = `
  select coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)::text as gun,
         pe.aksiyon, pe.durum, pe.created_by, pe.aciklama, m.id::text as customer_id, m.musteri
  from public.pipeline_eventleri pe
  left join public.musteriler m on m.id = pe.musteri_id
  where coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date) between $1::date and $2::date
    and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
`;

const Q_QUOTES = `
  select q.id::text as quote_id, q.quote_no, q.owner_user_id::text as owner_user_id, q.owner_name, q.status, q.closed_reason,
         q.total_amount::float8 as tutar, q.total_device_count as cihaz,
         coalesce(q.proposal_date, (q.created_at at time zone 'Europe/Istanbul')::date)::text as acilis,
         (coalesce(q.closed_at, q.updated_at) at time zone 'Europe/Istanbul')::date::text as kapanis,
         m.id::text as customer_id, m.musteri
  from public.quotes q
  left join public.musteriler m on m.id = q.customer_id
  where q.status <> 'draft'
    and (
      coalesce(q.proposal_date, (q.created_at at time zone 'Europe/Istanbul')::date) between $1::date and $2::date
      or (q.status = 'closed' and (coalesce(q.closed_at, q.updated_at) at time zone 'Europe/Istanbul')::date between $1::date and $2::date)
    )
`;

const Q_INVOICES = `
  select s.sale_date::text as gun, s.quote_id::text as quote_id, s.owner_user_id::text as owner_user_id, s.owner_name,
         s.amount::float8 as tutar, s.device_count as cihaz, m.id::text as customer_id, m.musteri,
         coalesce((
           select string_agg(i.product_code || ' × ' || i.quantity || case when i.sale_type = 'rental' then ' (kira)' else '' end, ' · ' order by i.line_no)
           from public.crm_sale_items i where i.sale_id = s.id
         ), '') as kalemler
  from public.crm_sales s
  left join public.musteriler m on m.id = s.customer_id
  where s.status = 'active' and s.sale_date between $1::date and $2::date
`;

const Q_MOVES = `
  select (h.moved_at at time zone 'Europe/Istanbul')::date::text as gun, h.firma, h.satici,
         h.owner_user_id::text as owner_user_id, h.from_satici, h.from_kategori, h.to_kategori, h.moved_by
  from public.crm_musteri_listesi_hareket h
  where (h.moved_at at time zone 'Europe/Istanbul')::date between $1::date and $2::date
`;

const Q_USERS = `select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name from public.allowed_users u`;

const CAT: Record<string, string> = { L: 'Lead', H: 'Hunter', F: 'Farmer', K: 'Kasa' };

async function safeRows(sql: string, params: unknown[]): Promise<Row[]> {
  try {
    return (await db.query(sql, params as never[])).rows as Row[];
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === '42P01' || code === '42703' || code === '42883') return [];
    throw error;
  }
}

export async function buildPerformanceEvents(options: { period: PerfPeriodKind; owner: string | null; today?: Date }): Promise<PerfEventsPayload> {
  const todayKey = istanbulDayKey(options.today ?? new Date());
  const range = perfRange(options.period, todayKey);
  const params = [range.from, todayKey];
  const [users, acts, quotes, invoices, moves] = await Promise.all([
    safeRows(Q_USERS, []), safeRows(Q_ACTIVITIES, params), safeRows(Q_QUOTES, params), safeRows(Q_INVOICES, params), safeRows(Q_MOVES, params),
  ]);

  const target = options.owner ? normalizeName(options.owner) : null;
  const nameById = new Map(users.map((u) => [String(u.id), String(u.name)]));
  const mine = (userId: unknown, name: unknown) => {
    if (!target) return true;
    const byId = userId ? nameById.get(String(userId)) : null;
    if (byId && normalizeName(byId) === target) return true;
    return name ? normalizeName(String(name)) === target : false;
  };

  const events: PerfEvent[] = [];
  const inRange = (d: string | null | undefined) => !!d && d >= range.from && d <= todayKey;

  for (const r of acts) {
    if (!mine(null, r.created_by)) continue;
    const label = activityLabelFromRow(r);
    const kind = activityTargetKind(label);
    const meeting = kind === 'salesPhysical' || kind === 'salesOnline';
    events.push({
      date: String(r.gun), type: meeting ? 'gorusme' : 'aktivite', owner: String(r.created_by ?? ''),
      customerId: r.customer_id ?? null, customer: r.musteri ?? '—',
      detail: [label, r.durum, r.aciklama ? String(r.aciklama).slice(0, 140) : null].filter(Boolean).join(' · '),
      amount: null, devices: null, href: r.customer_id ? `/crm/${r.customer_id}` : null,
    });
  }
  for (const r of quotes) {
    if (!mine(r.owner_user_id, r.owner_name)) continue;
    const base = { owner: String(r.owner_name ?? ''), customerId: r.customer_id ?? null, customer: r.musteri ?? '—', amount: num(r.tutar), devices: r.cihaz == null ? null : num(r.cihaz), href: r.quote_id ? `/crm/quotes/${r.quote_id}` : null };
    if (inRange(r.acilis)) events.push({ ...base, date: String(r.acilis), type: 'teklif', detail: `Teklif ${r.quote_no ?? ''} gönderildi` });
    if (r.status === 'closed' && inRange(r.kapanis)) {
      const won = r.closed_reason === 'won';
      events.push({ ...base, date: String(r.kapanis), type: won ? 'kazanim' : 'kayip', detail: `Teklif ${r.quote_no ?? ''} ${won ? 'kazanıldı' : `kapandı (${r.closed_reason ?? '—'})`}` });
    }
  }
  for (const r of invoices) {
    if (!mine(r.owner_user_id, r.owner_name)) continue;
    events.push({
      date: String(r.gun), type: 'fatura', owner: String(r.owner_name ?? ''), customerId: r.customer_id ?? null, customer: r.musteri ?? '—',
      detail: r.kalemler ? `Fatura · ${r.kalemler}` : 'Fatura', amount: num(r.tutar), devices: r.cihaz == null ? null : num(r.cihaz),
      href: r.quote_id ? `/crm/quotes/${r.quote_id}` : r.customer_id ? `/crm/${r.customer_id}` : '/crm/sales',
    });
  }
  for (const r of moves) {
    if (!mine(r.owner_user_id, r.satici) && !(target && r.from_satici && normalizeName(String(r.from_satici)) === target)) continue;
    const from = r.from_kategori ? CAT[r.from_kategori] ?? r.from_kategori : '—';
    const to = CAT[r.to_kategori] ?? r.to_kategori;
    const who = r.from_satici && r.from_satici !== r.satici ? ` · ${r.from_satici} → ${r.satici}` : '';
    events.push({
      date: String(r.gun), type: 'cevirme', owner: String(r.satici ?? ''), customerId: null, customer: String(r.firma ?? '—'),
      detail: `${from} → ${to}${who}${r.moved_by ? ` (işlem: ${r.moved_by})` : ''}`, amount: null, devices: null, href: '/crm/customer-list',
    });
  }

  events.sort((a, b) => (a.date === b.date ? a.type.localeCompare(b.type) : b.date.localeCompare(a.date)));
  return { range: { from: range.from, to: todayKey, label: range.label }, owner: options.owner, total: events.length, truncated: events.length > LIMIT, events: events.slice(0, LIMIT) };
}
