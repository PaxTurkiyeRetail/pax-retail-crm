import 'server-only';
import { db } from '@/lib/db';
import { istanbulDayKey } from '@/lib/reports/live-board-shared';
import { dayDiffKeys, type InactiveRow } from '@/lib/reports/inactive-customers-shared';

export { isInactiveRow, inactiveCountsByOwner, type InactiveCounts, type InactiveRow } from '@/lib/reports/inactive-customers-shared';

/**
 * HAREKETSİZ FİRMALAR — Çağdaş Bey, 11.09.2026:
 *   "Firma Hunter'da ya da Farmer'da olsun; 15 gündür üzerinde hareket yoksa hareketsize dönsün.
 *    Basınca gitsin o firmaları göreyim, listesi açılsın… New Tab açsın."
 *
 * TANIM (eskisi kalktı): önceki "Hareketsiz", aktif fırsatlardan (faz 4–14) 7 gün dokunulmayanlardı.
 * Yenisi Müşteri Listesi'ne (H/F/L/K) dayanır — kişinin Hunter ya da Farmer kolonundaki firmalar.
 * Lead ve Kasa Firması SAYILMAZ (Çağdaş Bey: "Lead'deyse gerek yok, kasa firmasındaysa gene").
 *
 * FİRMA EŞLEŞTİRME: Müşteri Listesi satırları serbest metindir (`crm_musteri_listesi.firma`),
 * künyeye bağlı değildir. Ad, Türkçe karakter ve noktalama duyarsız normalize edilerek
 * `musteriler.musteri` ile eşlenir; aynı anahtarda birden çok firma varsa eşleşme yapılmaz
 * (yanlış firmanın aktivitesi sayılmasın). Eşleşmeyen satırlar `matched=false` döner: sayıya
 * girmezler, listede "künye eşleşmedi" olarak görünürler.
 *
 * SON HAREKET: `pipeline_eventleri` — planlanan aksiyonlar (durum='Başlamadı' + hedef tarihli)
 * hareket sayılmaz; Canlı Ekran'ın her yerinde aynı kural.
 */

const NORMALIZE_SQL = `regexp_replace(upper(translate(%s, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g')`;

const Q_INACTIVE = `
  with liste as (
    select l.satici, l.owner_user_id::text as owner_user_id, l.kategori, trim(l.firma) as firma,
           ${NORMALIZE_SQL.replace('%s', 'l.firma')} as key
    from public.crm_musteri_listesi l
    where l.is_active and l.kategori in ('H', 'F')
  ),
  cust as (
    select m.id, m.musteri, ${NORMALIZE_SQL.replace('%s', 'm.musteri')} as key
    from public.musteriler m
  ),
  tek as (
    -- Yalnız TEK adayı olan ad eşleşir; aynı ada iki künye varsa hangisi olduğu belirsizdir.
    select key, (array_agg(id order by id))[1] as id, (array_agg(musteri order by id))[1] as musteri
    from cust group by key having count(*) = 1
  )
  select liste.satici as owner, liste.owner_user_id, liste.kategori, liste.firma,
         tek.id::text as customer_id, tek.musteri,
         la.last_day::text as last_day
  from liste
  left join tek on tek.key = liste.key
  left join lateral (
    select max(coalesce(pe.aktivite_tarihi, (pe.created_at at time zone 'Europe/Istanbul')::date)) as last_day
    from public.pipeline_eventleri pe
    where pe.musteri_id = tek.id
      and not (pe.durum = 'Başlamadı' and pe.hedef_tarihi is not null)
  ) la on true
  order by liste.satici, la.last_day nulls first, liste.firma
`;

function isMissingTable(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '42P01';
}

/** Müşteri Listesi'ndeki tüm Hunter/Farmer satırları + son hareket bilgisi. Tablo yoksa boş. */
export async function loadHunterFarmerActivity(today?: Date): Promise<InactiveRow[]> {
  const todayKey = istanbulDayKey(today ?? new Date());
  try {
    const { rows } = await db.query<{
      owner: string; owner_user_id: string | null; kategori: 'H' | 'F'; firma: string;
      customer_id: string | null; musteri: string | null; last_day: string | null;
    }>(Q_INACTIVE);
    return rows.map((row) => {
      const last = row.last_day ? String(row.last_day).slice(0, 10) : null;
      return {
        owner: String(row.owner ?? '').trim(),
        ownerUserId: row.owner_user_id,
        category: row.kategori,
        firma: String(row.firma ?? '').trim(),
        customerId: row.customer_id,
        musteri: row.musteri,
        matched: Boolean(row.customer_id),
        lastActivityAt: last,
        days: last ? dayDiffKeys(last, todayKey) : null,
      };
    });
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}
