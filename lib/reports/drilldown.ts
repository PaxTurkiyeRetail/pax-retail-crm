import 'server-only';
import { db } from '@/lib/db';
import { activityLabelFromRow } from '@/lib/activities/presentation';
import { activityTargetKind } from '@/lib/reports/weekly-targets-shared';
import { LIVE_BOARD_RULES, istanbulDayKey } from '@/lib/reports/live-board-shared';
import {
  drilldownTitle,
  type DrilldownColumn,
  type DrilldownParams,
  type DrilldownPayload,
  type DrilldownRow,
} from '@/lib/reports/drilldown-shared';

// KIRILIM — Canlı Ekran kutularının arkasındaki listeler (15.09.2026).
// Çağdaş Bey: "her şey için linkleme istiyoruz"; model çubuğuna basınca "A80'den kime kaç tane
// satmışız" görünsün. Tek sayfa, tek yükleyici: yeni sayaç eklenince buraya bir `kind` eklenir.
//
// ORTAK KURALLAR
//   * Satışçı filtresi ADA göre (Canlı Ekran OWNER_ORDER yazımı) — kişi slaydından gelen link
//     `?satisci=Furkan Kızılkurt` gönderir.
//   * Ciro/cihaz tarafı `crm_sales` (aktif) + `crm_sale_items` (030); teklif tarafı `quotes`.
//   * Kapsama YALNIZ ziyaret + online görüşme sayar (15.09 kararı) — Canlı Ekran ile aynı tanım.

const money = (value: number) => `$${Math.round(Number(value ?? 0)).toLocaleString('tr-TR')}`;
const count = (value: number) => Number(value ?? 0).toLocaleString('tr-TR');

/* --- Cihaz kırılımı: model × firma ---------------------------------------- */

const Q_DEVICES = `
  select m.id::text as customer_id, m.musteri,
         upper(trim(i.product_code)) as model,
         case when i.sale_type = 'rental' then 'rental' else 'sale' end as mode,
         sum(i.quantity)::int as adet,
         sum(i.total_price)::float8 as tutar,
         max(s.sale_date)::text as son_satis
  from public.crm_sale_items i
  join public.crm_sales s on s.id = i.sale_id
  join public.musteriler m on m.id = s.customer_id
  where s.status = 'active'
    and extract(year from s.sale_date) = $1::int
    and ($2 = '' or s.owner_name = $2)
    and ($3 = '' or upper(trim(i.product_code)) = $3)
    and ($4 = '' or (case when i.sale_type = 'rental' then 'rental' else 'sale' end) = $4)
    and public.crm_sale_item_is_device(i.product_type, i.is_recurring)
  group by 1, 2, 3, 4
  order by 5 desc, 2
`;

/* --- Teklifler ------------------------------------------------------------- */

const Q_QUOTES = `
  select m.id::text as customer_id, m.musteri, q.quote_no, q.owner_name,
         q.status, q.closed_reason, q.probability,
         q.total_amount::float8 as tutar, q.total_device_count as cihaz,
         q.proposal_date::text as tarih, q.valid_until::text as gecerlilik
  from public.quotes q
  join public.musteriler m on m.id = q.customer_id
  where ($1 = '' or q.owner_name = $1)
    and (
      ($2 = 'acik'       and q.status in ('sent', 'draft'))
      or ($2 = 'kazanilan' and q.status = 'closed' and q.closed_reason = 'won'       and extract(year from coalesce(q.closed_at, q.updated_at)) = $3::int)
      or ($2 = 'kaybedilen' and q.status = 'closed' and q.closed_reason in ('lost', 'expired', 'no_interest') and extract(year from coalesce(q.closed_at, q.updated_at)) = $3::int)
    )
  order by q.total_amount desc
`;

/* --- Kapsama: yıl içinde ziyaret / online görüşme yapılan firmalar ---------- */

const Q_COVERAGE = `
  select m.id::text as customer_id, m.musteri, coalesce(nullif(trim(m.sorumlu), ''), '—') as sorumlu,
         pe.aksiyon, pe.durum, pe.created_by,
         coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)::text as gun
  from public.pipeline_eventleri pe
  join public.musteriler m on m.id = pe.musteri_id
  where coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)
        between make_date($1::int, 1, 1) and $2::date
    and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
    and ($3 = '' or pe.created_by = $3)
`;

/* --- Portföy --------------------------------------------------------------- */

const Q_PORTFOLIO = `
  select m.id::text as customer_id, m.musteri, coalesce(nullif(trim(m.sorumlu), ''), '—') as sorumlu,
         coalesce(nullif(trim(m.sektor), ''), '—') as sektor,
         mp.aktif_faz_no as faz, ft.asama_adi as faz_adi,
         la.gun::text as son_hareket
  from public.musteriler m
  left join public.musteri_pipeline mp on mp.musteri_id = m.id
  left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
  left join lateral (
    select max(coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)) as gun
    from public.pipeline_eventleri pe
    where pe.musteri_id = m.id and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
  ) la on true
  where ($1 = '' or coalesce(nullif(trim(m.sorumlu), ''), '') = $1)
  order by la.gun desc nulls last, m.musteri
`;

/* --- Aktif POC / Pilot ----------------------------------------------------- */

const Q_POC = `
  select m.id::text as customer_id, m.musteri, coalesce(nullif(trim(m.sorumlu), ''), '—') as sorumlu,
         mp.aktif_faz_no as faz, ft.asama_adi as faz_adi,
         mp.baslangic_tarihi::text as baslangic, mp.hedef_tarihi::text as hedef,
         la.gun::text as son_hareket
  from public.musteriler m
  join public.musteri_pipeline mp on mp.musteri_id = m.id
  left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
  left join lateral (
    select max(coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)) as gun
    from public.pipeline_eventleri pe
    where pe.musteri_id = m.id and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
  ) la on true
  where mp.aktif_faz_no = any($1::int[])
    and ($2 = '' or coalesce(nullif(trim(m.sorumlu), ''), '') = $2)
  order by mp.hedef_tarihi nulls last, m.musteri
`;

/* --- Kesilen faturalar (satış kayıtları) ----------------------------------- */

const Q_INVOICES = `
  select m.id::text as customer_id, m.musteri, s.sale_date::text as tarih,
         s.device_count as cihaz, s.amount::float8 as tutar,
         coalesce(s.sales_channel, '—') as kanal, s.owner_name,
         coalesce((
           select string_agg(i.product_code || ' × ' || i.quantity, ' · ' order by i.line_no)
           from public.crm_sale_items i where i.sale_id = s.id
         ), '—') as kalemler
  from public.crm_sales s
  join public.musteriler m on m.id = s.customer_id
  where s.status = 'active'
    and extract(year from s.sale_date) = $1::int
    and ($2 = '' or s.owner_name = $2)
  order by s.sale_date desc, m.musteri
`;

function isMissingRelation(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
  return code === '42P01' || code === '42883';
}

async function safeQuery<T>(sql: string, params: unknown[]): Promise<T[]> {
  try {
    const { rows } = await db.query(sql, params as never[]);
    return rows as T[];
  } catch (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', sent: 'Gönderildi', won: 'Kazanıldı',
  lost: 'Kaybedildi', expired: 'Süresi doldu', no_interest: 'İlgi yok',
};

export async function loadDrilldown(params: DrilldownParams, today = new Date()): Promise<DrilldownPayload> {
  const todayKey = istanbulDayKey(today);
  const owner = params.owner ?? '';
  const title = drilldownTitle(params);
  const scope = params.owner ? params.owner : 'Tüm satış ekibi';

  if (params.kind === 'cihaz') {
    const rows = await safeQuery<{ customer_id: string; musteri: string; model: string; mode: string; adet: number; tutar: number; son_satis: string }>(
      Q_DEVICES, [params.year, owner, params.model ?? '', params.mode ?? ''],
    );
    const total = rows.reduce((sum, row) => sum + Number(row.adet ?? 0), 0);
    const amount = rows.reduce((sum, row) => sum + Number(row.tutar ?? 0), 0);
    const columns: DrilldownColumn[] = [
      { key: 'musteri', label: 'Firma' },
      { key: 'model', label: 'Model', width: '120px' },
      { key: 'mode', label: 'Tür', width: '110px' },
      { key: 'adet', label: 'Adet', align: 'right', width: '90px' },
      { key: 'tutar', label: 'Tutar', align: 'right', width: '130px' },
      { key: 'son', label: 'Son satış', width: '130px' },
    ];
    return {
      title, subtitle: `${scope} · ${params.year}`, columns,
      rows: rows.map((row) => ({
        customerId: row.customer_id,
        sortValue: Number(row.adet ?? 0),
        cells: [row.musteri, row.model, row.mode === 'rental' ? 'Kiralama' : 'Satış', count(row.adet), money(row.tutar), row.son_satis],
      })),
      stats: [
        { label: 'Toplam cihaz', value: count(total) },
        { label: 'Tutar', value: money(amount) },
        { label: 'Firma', value: count(new Set(rows.map((row) => row.customer_id)).size) },
      ],
      note: 'Kaynak: aktif satışların kalemleri (fatura satırları). Kalemi girilmemiş eski satışlar burada görünmez.',
    };
  }

  if (params.kind === 'teklif') {
    const state = params.state ?? 'acik';
    const rows = await safeQuery<{ customer_id: string; musteri: string; quote_no: string; owner_name: string; status: string; closed_reason: string | null; probability: number; tutar: number; cihaz: number; tarih: string; gecerlilik: string }>(
      Q_QUOTES, [owner, state, params.year],
    );
    const amount = rows.reduce((sum, row) => sum + Number(row.tutar ?? 0), 0);
    const columns: DrilldownColumn[] = [
      { key: 'musteri', label: 'Firma' },
      { key: 'quote_no', label: 'Teklif no', width: '150px' },
      { key: 'durum', label: 'Durum', width: '130px' },
      { key: 'cihaz', label: 'Cihaz', align: 'right', width: '90px' },
      { key: 'tutar', label: 'Tutar', align: 'right', width: '130px' },
      { key: 'tarih', label: 'Teklif tarihi', width: '130px' },
      { key: 'satisci', label: 'Satışçı', width: '160px' },
    ];
    return {
      title, subtitle: `${scope} · ${state === 'acik' ? 'açık (gönderilmiş + taslak)' : params.year}`, columns,
      rows: rows.map((row) => ({
        customerId: row.customer_id,
        sortValue: Number(row.tutar ?? 0),
        cells: [
          row.musteri, row.quote_no,
          QUOTE_STATUS_LABEL[String(row.closed_reason ?? row.status)] ?? row.status,
          count(row.cihaz), money(row.tutar), row.tarih, row.owner_name,
        ],
      })),
      stats: [
        { label: 'Teklif', value: count(rows.length) },
        { label: 'Tutar', value: money(amount) },
        { label: 'Cihaz', value: count(rows.reduce((sum, row) => sum + Number(row.cihaz ?? 0), 0)) },
      ],
      note: state === 'acik' ? 'Açık teklif = gönderilmiş + taslak (Canlı Ekran ile aynı tanım).' : null,
    };
  }

  if (params.kind === 'kapsama') {
    const raw = await safeQuery<{ customer_id: string; musteri: string; sorumlu: string; aksiyon: string | null; durum: string | null; created_by: string | null; gun: string }>(
      Q_COVERAGE, [params.year, todayKey, owner],
    );
    const byCustomer = new Map<string, { musteri: string; sorumlu: string; temas: number; son: string }>();
    for (const row of raw) {
      // Kapsama YALNIZ ziyaret + online görüşme (15.09) — mail ve telefon sayılmaz.
      const kind = activityTargetKind(activityLabelFromRow(row));
      if (kind !== 'salesPhysical' && kind !== 'salesOnline') continue;
      const cur = byCustomer.get(row.customer_id) ?? { musteri: row.musteri, sorumlu: row.sorumlu, temas: 0, son: row.gun };
      cur.temas += 1;
      if (row.gun > cur.son) cur.son = row.gun;
      byCustomer.set(row.customer_id, cur);
    }
    const list = Array.from(byCustomer.entries()).sort((a, b) => b[1].temas - a[1].temas || a[1].musteri.localeCompare(b[1].musteri, 'tr'));
    const totalContacts = list.reduce((sum, [, row]) => sum + row.temas, 0);
    return {
      title, subtitle: `${scope} · ${params.year}`,
      columns: [
        { key: 'musteri', label: 'Firma' },
        { key: 'sorumlu', label: 'Sorumlu', width: '170px' },
        { key: 'temas', label: 'Temas', align: 'right', width: '100px' },
        { key: 'son', label: 'Son görüşme', width: '140px' },
      ],
      rows: list.map(([customerId, row]) => ({
        customerId, sortValue: row.temas,
        cells: [row.musteri, row.sorumlu, count(row.temas), row.son],
      })),
      stats: [
        { label: 'Kapsanan firma', value: count(list.length) },
        { label: 'Toplam temas', value: count(totalContacts) },
        { label: 'Ortalama temas', value: list.length ? (Math.round((totalContacts / list.length) * 10) / 10).toLocaleString('tr-TR') : '0' },
      ],
      note: 'Yalnız fiziki ziyaret ve online görüşme sayılır; mail ve telefon kapsamaya girmez (15.09 kararı).',
    };
  }

  if (params.kind === 'poc') {
    // 22.09 (Sinan: "linklenmesinde diğer fazlar da görünüyor, onlar görünmezse süper olur"):
    // liste artık YALNIZ `pocPhases` (faz 12). Eskiden rollout (24) da ekleniyordu — "Aktif POC"
    // sayısı 5 iken liste 7 satır gösteriyordu; sayı ile arkasındaki liste AYNI kümeyi göstermeli
    // (17.09 kuralı: "iki farklı sonuç istemiyoruz"). Canlı Ekran'ın "POC · Pilot · Rollout"
    // SLAYDI değişmedi — başlığı rollout'u zaten vaat ediyor, o ayrı bir ekran.
    const rows = await safeQuery<{ customer_id: string; musteri: string; sorumlu: string; faz: number; faz_adi: string | null; baslangic: string | null; hedef: string | null; son_hareket: string | null }>(
      Q_POC, [[...LIVE_BOARD_RULES.pocPhases], owner],
    );
    return {
      title, subtitle: scope,
      columns: [
        { key: 'musteri', label: 'Firma' },
        { key: 'sorumlu', label: 'Sorumlu', width: '170px' },
        { key: 'faz', label: 'Faz', width: '200px' },
        { key: 'baslangic', label: 'Başlangıç', width: '130px' },
        { key: 'hedef', label: 'Hedef tarih', width: '130px' },
        { key: 'son', label: 'Son hareket', width: '130px' },
      ],
      rows: rows.map((row) => ({
        customerId: row.customer_id,
        cells: [row.musteri, row.sorumlu, `${row.faz}${row.faz_adi ? ` · ${row.faz_adi}` : ''}`, row.baslangic, row.hedef, row.son_hareket],
      })),
      stats: [{ label: 'Aktif POC', value: count(rows.length) }],
      note: `Yalnız faz ${LIVE_BOARD_RULES.pocPhases.join(', ')} (POC Scope / Pilot Lokasyon). Rollout (faz ${LIVE_BOARD_RULES.rolloutPhase}) bu listede YOK — Canlı Ekran'ın "POC · Pilot · Rollout" slaydında görünür.`,
    };
  }

  if (params.kind === 'fatura') {
    const rows = await safeQuery<{ customer_id: string; musteri: string; tarih: string; cihaz: number; tutar: number; kanal: string; owner_name: string; kalemler: string }>(
      Q_INVOICES, [params.year, owner],
    );
    const amount = rows.reduce((sum, row) => sum + Number(row.tutar ?? 0), 0);
    return {
      title, subtitle: `${scope} · ${params.year}`,
      columns: [
        { key: 'musteri', label: 'Firma' },
        { key: 'tarih', label: 'Tarih', width: '130px' },
        { key: 'kalemler', label: 'Kalemler' },
        { key: 'cihaz', label: 'Cihaz', align: 'right', width: '90px' },
        { key: 'tutar', label: 'Tutar', align: 'right', width: '130px' },
        { key: 'kanal', label: 'Kanal', width: '130px' },
      ],
      rows: rows.map((row) => ({
        customerId: row.customer_id, sortValue: Number(row.tutar ?? 0),
        cells: [row.musteri, row.tarih, row.kalemler, count(row.cihaz), money(row.tutar), row.kanal],
      })),
      stats: [
        { label: 'Fatura', value: count(rows.length) },
        { label: 'Tutar', value: money(amount) },
        { label: 'Cihaz', value: count(rows.reduce((sum, row) => sum + Number(row.cihaz ?? 0), 0)) },
      ],
      note: 'Bir satış kaydı = bir fatura. Aynı gün + aynı firma satırları tek faturada birleşir.',
    };
  }

  // portfoy (varsayılan)
  const rows = await safeQuery<{ customer_id: string; musteri: string; sorumlu: string; sektor: string; faz: number | null; faz_adi: string | null; son_hareket: string | null }>(
    Q_PORTFOLIO, [owner],
  );
  const stale = rows.filter((row) => !row.son_hareket).length;
  return {
    title, subtitle: scope,
    columns: [
      { key: 'musteri', label: 'Firma' },
      { key: 'sorumlu', label: 'Sorumlu', width: '170px' },
      { key: 'sektor', label: 'Sektör', width: '200px' },
      { key: 'faz', label: 'Faz', width: '200px' },
      { key: 'son', label: 'Son hareket', width: '140px' },
    ],
    rows: rows.map((row) => ({
      customerId: row.customer_id,
      cells: [row.musteri, row.sorumlu, row.sektor, row.faz == null ? '—' : `${row.faz}${row.faz_adi ? ` · ${row.faz_adi}` : ''}`, row.son_hareket],
    })),
    stats: [
      { label: 'Firma', value: count(rows.length) },
      { label: 'Hiç hareketi yok', value: count(stale) },
    ],
    note: null,
  };
}

export type { DrilldownPayload } from '@/lib/reports/drilldown-shared';
