import { db } from '@/lib/db';
import { buildLiveBoard } from '@/lib/reports/live-board';
import { normalizeName } from '@/lib/reports/live-board-shared';
import { loadHunterFarmerActivity } from '@/lib/reports/inactive-customers';
import { isInactiveRow } from '@/lib/reports/inactive-customers-shared';
import { activityLabelFromRow } from '@/lib/activities/presentation';
import { activityTargetKind } from '@/lib/reports/weekly-targets-shared';

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
  // H/F/K firma isim listeleri (22.09) — badge tıklanınca kim olduğu görülsün.
  hunterFirmNames: string[];
  farmerFirmNames: string[];
  kasaFirmNames: string[];
  // B = Banka/Finans sektöründeki firma sayısı (23.09, Taha talebi) — H/F/K'nın yanına.
  bankaFirmNames: string[];
  // L = Lead firma isim listesi (23.09, müdür talebi) — H/F/K/B'nin yanına.
  leadFirmNames: string[];
  // Hareketli firma isimleri (23.09, Taha talebi) — Hareketsiz'in yanına, aynı Müşteri Listesi
  // kaynağından (Hunter/Farmer), sadece "hareketsiz DEĞİL" (matched && !isInactiveRow) filtresiyle.
  activeFirmNames: string[];
  // Temas edilen müşteri isim listesi (23.09) — coverage.coveredCustomers sayısının detayı,
  // live-board.ts'deki AYNI sınıflandırmayla (activityTargetKind: salesPhysical/salesOnline).
  coveredCustomerNames: string[];
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

// H/F/K/B/L firma isim listeleri (23.09 düzeltme, Taha): H+F+K+B+L toplamı Portföy'e EŞİT
// olmalı — her firma tek kolonda sayılır (mutually exclusive), kategori öncelik sırasıyla ayrılır:
// 1) sektör Banka/Finans ise → B (etiketi ne olursa olsun)
// 2) değilse etiket=farmer → F
// 3) değilse etiket=kasa → K (satıcı etiketindeki "Kasa" — iş ortağı DEĞİL)
// 4) değilse etiket=lead → L (müdür talebi: Lead ayrı görünsün)
// 5) kalan (Hunter/boş) → H
const Q_PORTFOLIO_FIRMS = `
  with cat as (
    select coalesce(nullif(trim(m.sorumlu), ''), '—') as owner,
           m.musteri,
           case
             when m.sektor = 'Banka / Finans' then 'banka'
             when lower(trim(coalesce(kv.satici_etiketi, ''))) = 'farmer' then 'farmer'
             when lower(trim(coalesce(kv.satici_etiketi, ''))) = 'kasa' then 'kasa'
             when lower(trim(coalesce(kv.satici_etiketi, ''))) = 'lead' then 'lead'
             else 'hunter'
           end as kategori
    from public.musteriler m
    left join public.musteri_kunye_v2 kv on kv.musteri_id = m.id
  )
  select owner,
         array_agg(musteri order by musteri) filter (where kategori = 'hunter') as hunter,
         array_agg(musteri order by musteri) filter (where kategori = 'farmer') as farmer,
         array_agg(musteri order by musteri) filter (where kategori = 'kasa') as kasa,
         array_agg(musteri order by musteri) filter (where kategori = 'banka') as banka,
         array_agg(musteri order by musteri) filter (where kategori = 'lead') as lead
  from cat
  group by 1
`;

// Temas edilen müşteri (23.09): live-board.ts:719-731 ile AYNI kaynak + AYNI sınıflandırma
// (pipeline_eventleri, planlanan aksiyon hariç, yalnız salesPhysical/salesOnline). Yıl aralığı
// da aynı mantık: takvim yılı başından bugüne (İstanbul).
const Q_COVERED_CUSTOMERS = `
  select pe.aksiyon, pe.durum, pe.created_by, pe.musteri_id::text as musteri_id, m.musteri
  from public.pipeline_eventleri pe
  left join public.musteriler m on m.id = pe.musteri_id
  where coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)
        between make_date(extract(year from (now() at time zone 'Europe/Istanbul'))::int, 1, 1)
            and (now() at time zone 'Europe/Istanbul')::date
    and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
`;

type PortfolioFirmsRow = { owner: string; hunter: string[] | null; farmer: string[] | null; kasa: string[] | null; banka: string[] | null; lead: string[] | null };

async function portfolioFirmsByOwner() {
  const map = new Map<string, { hunter: string[]; farmer: string[]; kasa: string[]; banka: string[]; lead: string[] }>();
  try {
    const result = await db.query(Q_PORTFOLIO_FIRMS);
    for (const row of result.rows as PortfolioFirmsRow[]) {
      map.set(normalizeName(row.owner), {
        hunter: row.hunter ?? [],
        farmer: row.farmer ?? [],
        kasa: row.kasa ?? [],
        banka: row.banka ?? [],
        lead: row.lead ?? [],
      });
    }
  } catch (err) {
    console.error('[yil-ziyaret-portfoy] portföy firma sorgu hatası:', err);
  }
  return map;
}

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

type CoveredRow = { aksiyon: string | null; durum: string | null; created_by: string | null; musteri_id: string | null; musteri: string | null };

async function coveredCustomerNamesByOwner() {
  const map = new Map<string, Set<string>>();
  try {
    const result = await db.query(Q_COVERED_CUSTOMERS);
    for (const row of result.rows as CoveredRow[]) {
      const creator = (row.created_by ?? '').trim();
      if (!creator || !row.musteri) continue;
      const kind = activityTargetKind(activityLabelFromRow(row));
      if (kind !== 'salesPhysical' && kind !== 'salesOnline') continue;
      const key = normalizeName(creator);
      const set = map.get(key) ?? new Set<string>();
      set.add(row.musteri);
      map.set(key, set);
    }
  } catch (err) {
    console.error('[yil-ziyaret-portfoy] temas edilen müşteri sorgu hatası:', err);
  }
  const out = new Map<string, string[]>();
  for (const [key, set] of map) out.set(key, Array.from(set).sort((a, b) => a.localeCompare(b, 'tr')));
  return out;
}

async function activeFirmNamesByOwner() {
  const map = new Map<string, string[]>();
  try {
    const rows = await loadHunterFarmerActivity();
    for (const row of rows) {
      if (!row.matched || isInactiveRow(row) || !row.musteri) continue;
      const key = normalizeName(row.owner);
      const list = map.get(key) ?? [];
      list.push(row.musteri);
      map.set(key, list);
    }
    for (const [key, list] of map) map.set(key, [...new Set(list)].sort((a, b) => a.localeCompare(b, 'tr')));
  } catch (err) {
    console.error('[yil-ziyaret-portfoy] hareketli firma sorgu hatası:', err);
  }
  return map;
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
  const [board, forecast, blocker, kunye, portfolioFirms, activeFirms, coveredNames] = await Promise.all([
    buildLiveBoard(),
    hunterCompareByOwner(Q_FORECAST_HUNTER),
    hunterCompareByOwner(Q_BLOCKER_HUNTER),
    kunyeHealthByOwner(),
    portfolioFirmsByOwner(),
    activeFirmNamesByOwner(),
    coveredCustomerNamesByOwner(),
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
    hunterFirmNames: portfolioFirms.get(normalizeName(o.owner))?.hunter ?? [],
    farmerFirmNames: portfolioFirms.get(normalizeName(o.owner))?.farmer ?? [],
    kasaFirmNames: portfolioFirms.get(normalizeName(o.owner))?.kasa ?? [],
    bankaFirmNames: portfolioFirms.get(normalizeName(o.owner))?.banka ?? [],
    leadFirmNames: portfolioFirms.get(normalizeName(o.owner))?.lead ?? [],
    activeFirmNames: activeFirms.get(normalizeName(o.owner)) ?? [],
    coveredCustomerNames: coveredNames.get(normalizeName(o.owner)) ?? [],
  }));
  return { generatedAt: new Date().toISOString(), rows };
}
