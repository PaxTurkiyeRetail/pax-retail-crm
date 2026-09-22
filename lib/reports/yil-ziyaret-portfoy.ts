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

// Künye satıcı etiketi Hunter olan firma mı? (live-board.ts saticiEtiketi() ile AYNI mantık:
// boş/hunter değilse Hunter sayılır — farmer/lead/kasa hariç. Tek yerden okunur kuralı burada
// SQL'e taşınmış hâli, çünkü bu sorgular buildLiveBoard()'un dışında ayrı çalışıyor.)
const HUNTER_FILTER = `lower(trim(coalesce(kv.satici_etiketi, ''))) not in ('farmer', 'lead', 'kasa')`;

// Forecast girilmiş HUNTER firma adedi, satışçı bazında (bu yıl, aktif forecast satırları).
// DİKKAT: f.owner_name forecast girilirken yazılan SNAPSHOT isim — müşteri sonradan başka
// satışçıya devredilmişse güncel sorumluyu YANSITMAZ. Portföy/Blocker sayıları musteriler.sorumlu
// (güncel) üzerinden geldiği için burada da GÜNCEL sorumlu (m.sorumlu) kullanılıyor, owner_name değil.
const Q_FORECAST_FIRMS_BY_OWNER = `
  select coalesce(nullif(trim(m.sorumlu), ''), '—') as owner,
         count(distinct f.customer_id)::int as firms
  from public.crm_forecasts f
  join public.musteriler m on m.id = f.customer_id
  left join public.musteri_kunye_v2 kv on kv.musteri_id = f.customer_id
  where f.is_active = true and f.forecast_year = $1 and ${HUNTER_FILTER}
  group by 1
`;

// Engel & Etki KAYDI GİRİLMİŞ HUNTER firma adedi, satışçı bazında.
// DİKKAT: v.has_blocker "hâlâ açık/aktif engel var mı" demek (view'de: not has_blocker -> 'no_blocker'
// statüsü) — "kayıt girilmiş mi" demek DEĞİL. Girilmiş-mi karşılaştırması için blocker_id is not null
// kullanılır, has_blocker=false (engel yok diye kapatılmış) girişler de sayılmalı.
const Q_BLOCKER_FIRMS_BY_OWNER = `
  select coalesce(nullif(trim(v.sorumlu), ''), '—') as owner,
         count(distinct v.customer_id) filter (where v.blocker_id is not null)::int as firms
  from public.v_crm_forecast_blocker_impact v
  left join public.musteri_kunye_v2 kv on kv.musteri_id = v.customer_id
  where ${HUNTER_FILTER}
  group by 1
`;

async function countsByOwner(sql: string, params: unknown[] = []) {
  const map = new Map<string, number>();
  try {
    const result = await db.query(sql, params);
    for (const row of result.rows as Array<{ owner: string; firms: number }>) {
      map.set(normalizeName(row.owner), (map.get(normalizeName(row.owner)) ?? 0) + Number(row.firms ?? 0));
    }
  } catch (err) {
    // Rapor kırılmasın (0 dönsün) ama hata görünmez kalmasın — log'a düş.
    console.error('[yil-ziyaret-portfoy] sorgu hatası:', err);
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
