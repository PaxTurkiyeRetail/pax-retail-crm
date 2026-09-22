import { db } from '@/lib/db';
import { buildLiveBoard } from '@/lib/reports/live-board';
import { normalizeName } from '@/lib/reports/live-board-shared';

export type YilZiyaretPortfoyRow = {
  owner: string;
  initials: string;
  visitsYear: { actual: number; target: number | null; pct: number | null };
  portfolio: { total: number; active: number; farmer: number; hunter: number; kasa: number };
  coverage: {
    coveredCustomers: number;
    contactsPer: { actual: number; target: number | null; pct: number | null };
    activitiesYear: number;
  };
  inactive: { count: number; days: number; unmatched: number };
  // Hunter/Forecast/Engel&Etki kıyası (22.09, Taha, müdür talebi): "Hunter'ı olan satışçının
  // o kadar Forecast ve Engel&Etki girişi de olmalı" mantığıyla üç sayı yan yana.
  forecastFirms: number;
  blockerFirms: number;
};

export type YilZiyaretPortfoyPayload = {
  generatedAt: string;
  rows: YilZiyaretPortfoyRow[];
};

// Forecast girilmiş firma adedi, satışçı bazında (bu yıl, aktif forecast satırları).
const Q_FORECAST_FIRMS_BY_OWNER = `
  select coalesce(nullif(trim(f.owner_name), ''), '—') as owner,
         count(distinct f.customer_id)::int as firms
  from public.crm_forecasts f
  where f.is_active = true and f.forecast_year = $1
  group by 1
`;

// Engel & Etki kaydı olan firma adedi, satışçı bazında (view zaten forecast+blocker join'i).
const Q_BLOCKER_FIRMS_BY_OWNER = `
  select coalesce(nullif(trim(v.sorumlu), ''), '—') as owner,
         count(distinct v.customer_id) filter (where v.has_blocker)::int as firms
  from public.v_crm_forecast_blocker_impact v
  group by 1
`;

async function countsByOwner(sql: string, params: unknown[] = []) {
  const map = new Map<string, number>();
  try {
    const result = await db.query(sql, params);
    for (const row of result.rows as Array<{ owner: string; firms: number }>) {
      map.set(normalizeName(row.owner), (map.get(normalizeName(row.owner)) ?? 0) + Number(row.firms ?? 0));
    }
  } catch {
    // Tablo/view henüz yoksa (yeni ortam) rapor kırılmasın — 0 dönsün.
  }
  return map;
}

// Yıl Ziyaret & Portföy Sağlığı Raporu — Canlı Ekran'daki "Aktivite Hedefi" (yıl ziyaret) ve
// "Portföy Sağlığı" kartlarının tüm satışçılar için tek tabloda toplu görünümü (22.09).
// Ayrı sorgu YOK: veri zaten buildLiveBoard() içinde owner bazlı hesaplı — burada sadece
// ilgili alanlar seçilip düzleştiriliyor (altın kural 17: tek yerden okunur).
export async function buildYilZiyaretPortfoyRaporu(): Promise<YilZiyaretPortfoyPayload> {
  const year = new Date().getFullYear();
  const [board, forecastByOwner, blockerByOwner] = await Promise.all([
    buildLiveBoard(),
    countsByOwner(Q_FORECAST_FIRMS_BY_OWNER, [year]),
    countsByOwner(Q_BLOCKER_FIRMS_BY_OWNER),
  ]);
  const rows: YilZiyaretPortfoyRow[] = board.owners.map((o) => ({
    owner: o.owner,
    initials: o.initials,
    visitsYear: o.goals.visitsYear,
    portfolio: o.portfolio,
    coverage: {
      coveredCustomers: o.coverage.covered.actual,
      contactsPer: o.coverage.contactsPer,
      activitiesYear: o.coverage.activitiesYear,
    },
    inactive: o.inactive,
    forecastFirms: forecastByOwner.get(normalizeName(o.owner)) ?? 0,
    blockerFirms: blockerByOwner.get(normalizeName(o.owner)) ?? 0,
  }));
  return { generatedAt: new Date().toISOString(), rows };
}
