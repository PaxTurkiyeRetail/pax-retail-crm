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
  // Hangi Hunter firmalarda Forecast/Engel&Etki EKSİK — sayı tartışmalı geldiğinde göstermek için.
  missingForecastFirms: string[];
  missingBlockerFirms: string[];
  // Künye Sağlığı (22.09): tüm portföy (Hunter+Farmer+Lead+Kasa) için künye doluluk durumu.
  kunyeHealth: { tamam: number; eksik: number; yok: number };
  missingKunyeFirms: string[];
};

export type YilZiyaretPortfoyPayload = {
  generatedAt: string;
  rows: YilZiyaretPortfoyRow[];
};

// DİKKAT: "Hunter" burada live-board.ts'deki portfolio.hunter TANIMIYLA AYNI olmalı —
// orada hunter = rows.filter(row => !isFarmer(row)).length yani "Farmer DEĞİLSE" (Lead/Kasa/boş dahil,
// sadece Farmer hariç). Önceden burada lead/kasa da hariç tutulmuştu, bu yüzden has+missing toplamı
// portfolio.hunter'a hiç eşit olmuyordu (33 Hunter ama filtre ~24-27 firma buluyordu).
const HUNTER_FILTER = `lower(trim(coalesce(kv.satici_etiketi, ''))) <> 'farmer'`;

// TEK SORGUDA hem sayı hem eksik-liste: önceden ayrı sorgulardı, toplamları tutmuyordu
// (Hunter sayısı ≠ girilmiş + eksik). Şimdi tek derived table'dan geldiği için
// firms + missing.length HER ZAMAN owner'ın Hunter toplamına eşit.
// DİKKAT: f.owner_name forecast girilirken yazılan SNAPSHOT isim, müşteri devrolmuşse güncel
// sorumluyu yansıtmaz — bu yüzden GÜNCEL sorumlu (m.sorumlu) kullanılıyor, owner_name değil.
// DİKKAT 2 (22.09 teşhis): forecast_year = $1 (bu takvim yılı) filtresi YANLIŞTI — satışçılar
// forecast'ı GELECEK yıl için giriyor (ör. 2026'da 2027 forecast'ı), o yüzden "girilmiş" olan
// kayıtlar bile "eksik" görünüyordu. Yıl filtresi kaldırıldı: aktif herhangi bir forecast kaydı
// varsa "girilmiş" sayılır (hangi yıl için olursa olsun).
const Q_FORECAST_HUNTER = `
  with hunter_firms as (
    select coalesce(nullif(trim(m.sorumlu), ''), '—') as owner,
           m.musteri,
           exists (
             select 1 from public.crm_forecasts f
             where f.customer_id = m.id and f.is_active = true
           ) as has_forecast
    from public.musteriler m
    left join public.musteri_kunye_v2 kv on kv.musteri_id = m.id
    where ${HUNTER_FILTER}
  )
  select owner,
         count(*) filter (where has_forecast)::int as firms,
         array_agg(musteri order by musteri) filter (where not has_forecast) as missing
  from hunter_firms
  group by 1
`;

// v_crm_forecast_blocker_impact müşteri başına birden fazla satır üretebiliyor (forecast_id'ye göre
// birden fazla blocker girilmiş olabilir) — "distinct on" ile müşteri başına TEK satıra indirgeniyor,
// varsa girilmiş (blocker_id not null) satır tercih ediliyor. Böylece has+missing toplamı Hunter
// sayısını AŞMAZ / EKSİK KALMAZ.
const Q_BLOCKER_HUNTER = `
  with hunter_blocker as (
    select distinct on (v.customer_id)
           coalesce(nullif(trim(v.sorumlu), ''), '—') as owner,
           v.musteri,
           (v.blocker_id is not null) as answered
    from public.v_crm_forecast_blocker_impact v
    left join public.musteri_kunye_v2 kv on kv.musteri_id = v.customer_id
    where ${HUNTER_FILTER}
    order by v.customer_id, (v.blocker_id is not null) desc
  )
  select owner,
         count(*) filter (where answered)::int as firms,
         array_agg(musteri order by musteri) filter (where not answered) as missing
  from hunter_blocker
  group by 1
`;

// Künye Sağlığı (22.09): tüm portföy için (Hunter/Farmer/Lead/Kasa ayrımı YOK — künye doluluğu
// herkes için gerekli). Tanım live-board.ts:1052 ile AYNI: kunye_status='dolu' → Tamam,
// yoksa required_filled>0 → Eksik (girilmiş ama tam değil), yoksa Yok (hiç başlanmamış).
const Q_KUNYE_HEALTH = `
  with kunye_rows as (
    select coalesce(nullif(trim(m.sorumlu), ''), '—') as owner,
           m.musteri,
           case
             when k.kunye_status = 'dolu' then 'Tamam'
             when coalesce(k.required_filled, 0) > 0 then 'Eksik'
             else 'Yok'
           end as durum
    from public.musteriler m
    left join public.v_musteri_kunye_status k on k.musteri_id = m.id
  )
  select owner,
         count(*) filter (where durum = 'Tamam')::int as tamam,
         count(*) filter (where durum = 'Eksik')::int as eksik,
         count(*) filter (where durum = 'Yok')::int as yok,
         array_agg(musteri order by musteri) filter (where durum <> 'Tamam') as missing
  from kunye_rows
  group by 1
`;

type HunterCompareRow = { owner: string; firms: number; missing: string[] | null };
type KunyeHealthRow = { owner: string; tamam: number; eksik: number; yok: number; missing: string[] | null };

async function kunyeHealthByOwner() {
  const tamamMap = new Map<string, { tamam: number; eksik: number; yok: number }>();
  const missingMap = new Map<string, string[]>();
  try {
    const result = await db.query(Q_KUNYE_HEALTH);
    for (const row of result.rows as KunyeHealthRow[]) {
      const key = normalizeName(row.owner);
      tamamMap.set(key, { tamam: Number(row.tamam ?? 0), eksik: Number(row.eksik ?? 0), yok: Number(row.yok ?? 0) });
      missingMap.set(key, row.missing ?? []);
    }
  } catch (err) {
    console.error('[yil-ziyaret-portfoy] künye sorgu hatası:', err);
  }
  return { tamamMap, missingMap };
}

async function hunterCompareByOwner(sql: string, params: unknown[] = []) {
  const firmsMap = new Map<string, number>();
  const missingMap = new Map<string, string[]>();
  try {
    const result = await db.query(sql, params);
    for (const row of result.rows as HunterCompareRow[]) {
      const key = normalizeName(row.owner);
      firmsMap.set(key, Number(row.firms ?? 0));
      missingMap.set(key, row.missing ?? []);
    }
  } catch (err) {
    // Rapor kırılmasın (0 dönsün) ama hata görünmez kalmasın — log'a düş.
    console.error('[yil-ziyaret-portfoy] sorgu hatası:', err);
  }
  return { firmsMap, missingMap };
}

// Yıl Ziyaret & Portföy Sağlığı Raporu — Canlı Ekran'daki "Aktivite Hedefi" (yıl ziyaret) ve
// "Portföy Sağlığı" kartlarının tüm satışçılar için tek tabloda toplu görünümü (22.09).
// Ayrı sorgu YOK: veri zaten buildLiveBoard() içinde owner bazlı hesaplı — burada sadece
// ilgili alanlar seçilip düzleştiriliyor (altın kural 17: tek yerden okunur).
export async function buildYilZiyaretPortfoyRaporu(): Promise<YilZiyaretPortfoyPayload> {
  const [board, forecast, blocker, kunye] = await Promise.all([
    buildLiveBoard(),
    hunterCompareByOwner(Q_FORECAST_HUNTER),
    hunterCompareByOwner(Q_BLOCKER_HUNTER),
    kunyeHealthByOwner(),
  ]);
  const rows: YilZiyaretPortfoyRow[] = board.owners.map((o: { owner: string; initials: string; goals: { visitsYear: YilZiyaretPortfoyRow['visitsYear'] }; portfolio: YilZiyaretPortfoyRow['portfolio']; coverage: { covered: { actual: number }; contactsPer: YilZiyaretPortfoyRow['coverage']['contactsPer']; activitiesYear: number }; inactive: YilZiyaretPortfoyRow['inactive'] }) => ({
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
    forecastFirms: forecast.firmsMap.get(normalizeName(o.owner)) ?? 0,
    blockerFirms: blocker.firmsMap.get(normalizeName(o.owner)) ?? 0,
    missingForecastFirms: forecast.missingMap.get(normalizeName(o.owner)) ?? [],
    missingBlockerFirms: blocker.missingMap.get(normalizeName(o.owner)) ?? [],
    kunyeHealth: kunye.tamamMap.get(normalizeName(o.owner)) ?? { tamam: 0, eksik: 0, yok: 0 },
    missingKunyeFirms: kunye.missingMap.get(normalizeName(o.owner)) ?? [],
  }));
  return { generatedAt: new Date().toISOString(), rows };
}
