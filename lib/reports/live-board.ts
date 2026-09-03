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
  initialsOf,
  istanbulDayKey,
  rankOwners,
  weekRangeLabel,
  type LiveActivity,
  type LiveBoardPayload,
  type LiveFollowup,
  type LiveOwner,
} from '@/lib/reports/live-board-shared';

// Canlı Ekran veri katmanı — TEK payload.
//
// Neden tek uç: ekran gün boyu açık kalır ve 5 dakikada bir yenilenir. Kişi
// başına ayrı istek atmak (N satıcı × 3 uç) hem sunucuyu hem tarayıcıyı
// gereksiz yorar; burada iki mevcut rapor katmanı yeniden kullanılır
// (haftalık hedefler, açık takipler) ve üzerine iki hafif sorgu eklenir
// (haftanın aktivite hareketleri, haftanın teklifleri).
//
// Kişi seti: bu hafta aktivitesi OLAN, hedefi OLAN ya da açık takibi OLAN
// kullanıcılar. Yöneticiler/boş hesaplar boş slayt üretmesin.

const TOP_FOLLOWUPS = 5;
const RECENT_ACTIVITIES = 6;
const TEAM_SOONEST = 6;

function toLiveFollowup(row: SellerFollowupRow): LiveFollowup {
  return {
    customerId: row.customerId,
    musteri: row.musteri,
    konuKimde: row.konuKimde,
    takipKonusu: row.takipKonusu,
    modelAdetLabel: row.modelAdetLabel,
    totalQuantity: row.totalQuantity,
    cozumTarihi: row.cozumTarihi,
    overdue: row.overdue,
    nearTerm: row.nearTerm,
  };
}

/** Vadesi geçenler önce (en eski üstte), sonra en yakın tarih, tarihsizler sonda. */
function sortFollowups(rows: SellerFollowupRow[]) {
  return [...rows].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const da = a.cozumTarihi ?? '9999-12-31';
    const dbb = b.cozumTarihi ?? '9999-12-31';
    return da.localeCompare(dbb) || a.musteri.localeCompare(b.musteri, 'tr');
  });
}

export async function buildLiveBoard(options?: { today?: Date }): Promise<LiveBoardPayload> {
  const today = options?.today ?? new Date();
  const todayKey = istanbulDayKey(today);

  const [targets, followupReport] = await Promise.all([
    buildWeeklyTargets({ today }),
    buildSellerFollowupReport({ today }),
  ]);
  const { from, to } = targets.range;

  const [activityResult, quoteResult] = await Promise.all([
    db.query(
      `
        select pe.id::text as id, pe.created_by, pe.created_at, pe.aksiyon, pe.durum, pe.faz_no,
               pe.notlar, pe.hedef_tarihi, m.musteri
        from public.pipeline_eventleri pe
        left join public.musteriler m on m.id = pe.musteri_id
        where pe.created_at >= $1::date
          and pe.created_at < ($2::date + interval '1 day')
        order by pe.created_at desc
      `,
      [from, to],
    ),
    db.query(
      `
        select owner_name, count(*)::int as quote_count,
               coalesce(sum(total_device_count), 0)::int as device_count
        from public.quotes
        where created_at >= $1::date
          and created_at < ($2::date + interval '1 day')
        group by owner_name
      `,
      [from, to],
    ),
  ]);

  // Haftanın hareketleri kişi bazında: son 6 hareket + bugünkü sayı.
  const recentByOwner = new Map<string, LiveActivity[]>();
  const todayByOwner = new Map<string, number>();
  for (const row of activityResult.rows as any[]) {
    const ownerName = String(row.created_by ?? '').trim();
    if (!ownerName || !isDisplayableActivityRow(row)) continue;
    const createdAt = row.created_at ? new Date(row.created_at) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    const label = activityLabelFromRow(row);
    const kind = activityTargetKind(label);
    if (istanbulDayKey(createdAt) === todayKey && kind !== 'other') {
      todayByOwner.set(ownerName, (todayByOwner.get(ownerName) ?? 0) + 1);
    }
    const list = recentByOwner.get(ownerName) ?? [];
    if (list.length < RECENT_ACTIVITIES) {
      list.push({
        id: String(row.id),
        at: createdAt.toISOString(),
        musteri: String(row.musteri ?? '').trim() || '—',
        label: label === '-' ? 'Not' : label,
        kind,
        note: String(row.notlar ?? '').trim() || null,
      });
      recentByOwner.set(ownerName, list);
    }
  }

  const quotesByOwner = new Map<string, { count: number; devices: number }>();
  for (const row of quoteResult.rows as any[]) {
    const ownerName = String(row.owner_name ?? '').trim();
    if (ownerName) quotesByOwner.set(ownerName, { count: Number(row.quote_count) || 0, devices: Number(row.device_count) || 0 });
  }

  const followupsByOwner = new Map<string, SellerFollowupRow[]>();
  for (const row of followupReport.rows) {
    const ownerName = String(row.sorumlu ?? '').trim();
    if (!ownerName) continue;
    const list = followupsByOwner.get(ownerName) ?? [];
    list.push(row);
    followupsByOwner.set(ownerName, list);
  }

  const targetRowByOwner = new Map(targets.rows.map((row) => [row.owner, row]));
  const ownerNames = Array.from(new Set([
    ...targets.rows.map((row) => row.owner),
    ...followupsByOwner.keys(),
    ...recentByOwner.keys(),
  ])).filter(Boolean);

  const unranked = ownerNames.map((owner) => {
    const targetRow = targetRowByOwner.get(owner);
    const actual: WeeklyTargetCounters = targetRow?.actual ?? emptyWeeklyCounters();
    const target: WeeklyTargetCounters = targetRow?.target ?? emptyWeeklyCounters();
    const followups = sortFollowups(followupsByOwner.get(owner) ?? []);
    return {
      owner,
      initials: initialsOf(owner),
      actual,
      target,
      achievementPct: achievementPct(actual.totalActivities, target.totalActivities),
      todayActivities: todayByOwner.get(owner) ?? 0,
      quotes: quotesByOwner.get(owner) ?? { count: 0, devices: 0 },
      followups: {
        open: followups.length,
        overdue: followups.filter((row) => row.overdue).length,
        nearTermQuantity: followups.filter((row) => row.nearTerm).reduce((sum, row) => sum + row.totalQuantity, 0),
        top: followups.slice(0, TOP_FOLLOWUPS).map(toLiveFollowup),
      },
      recentActivities: recentByOwner.get(owner) ?? [],
    };
  });

  const owners: LiveOwner[] = rankOwners(unranked);

  const teamActual = owners.reduce((acc, row) => addWeeklyCounters(acc, row.actual), emptyWeeklyCounters());
  const teamTarget = owners.reduce((acc, row) => addWeeklyCounters(acc, row.target), emptyWeeklyCounters());
  const teamQuotes = owners.reduce(
    (acc, row) => ({ count: acc.count + row.quotes.count, devices: acc.devices + row.quotes.devices }),
    { count: 0, devices: 0 },
  );
  const soonest = sortFollowups(followupReport.rows).slice(0, TEAM_SOONEST).map(toLiveFollowup);

  return {
    generatedAt: new Date().toISOString(),
    range: { from, to, label: weekRangeLabel(from, to), today: todayKey },
    team: {
      ownerCount: owners.length,
      actual: teamActual,
      target: teamTarget,
      achievementPct: achievementPct(teamActual.totalActivities, teamTarget.totalActivities),
      todayActivities: owners.reduce((sum, row) => sum + row.todayActivities, 0),
      quotes: teamQuotes,
      followups: {
        open: followupReport.summary.openFollowupCount,
        overdue: followupReport.rows.filter((row) => row.overdue).length,
        nearTermQuantity: followupReport.summary.nearTermQuantity,
        nearTermLabel: followupReport.summary.nearTermLabel,
        soonest,
      },
    },
    owners,
  };
}
