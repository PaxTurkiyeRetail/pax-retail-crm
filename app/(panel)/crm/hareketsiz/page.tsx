import Link from 'next/link';
import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { isInactiveRow, loadHunterFarmerActivity } from '@/lib/reports/inactive-customers';
import {
  INACTIVE_SORT_DEFAULT_DIR, isInactiveSort, sortInactiveRows,
  type InactiveSort, type InactiveSortDir,
} from '@/lib/reports/inactive-customers-shared';
import { LIVE_BOARD_RULES, OWNER_ORDER, normalizeName, ownerOrderCompare } from '@/lib/reports/live-board-shared';
import { GhostFilterBar, ownerOptions } from '@/components/reports/GhostFilterBar';
import '@/styles/inactive.css';

// HAREKETSİZ FİRMALAR — Çağdaş Bey, 11.09.2026:
//   "15 gündür üzerinde işlem olmayan firma sayısı… Basınca gitsin o firmaları göreyim,
//    listesi açılsın… New Tab açsın."
// 15.09.2026 eki: "Hareketsiz firmalarda sıralama olmalı, tarihe göre güne göre sıralama
// yapması lazım." → başlıklar link; sıra URL'de (?sirala=gun&yon=desc), istemci JS'i yok.
// Canlı Ekran kişi slaydındaki "Hareketsiz Firma" sayacı bu sayfayı YENİ SEKMEDE açar
// (/crm/hareketsiz?satici=...&gun=15). TV'de açılacağı için sunucu bileşeni: istemci JS'i,
// yüklenme animasyonu ve ek istek yok — sayfa tek seferde basılır.
//
// Kapı: Müşteriler ekranıyla aynı (customer.read + screen.crm.customers.view) — liste
// firma adı ve son hareket tarihinden ibaret, künye verisi taşımaz.
//
// 17.09 (Sinan, "hayalet ekranlara linkten gidince filtre ve sayı gelsin"): üstte filtre çubuğu
// (satıcı · gün eşiği — GET formu, JS'siz; sıralama korunur), başlıkta toplam firma, tabloda # kolonu.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORY_LABEL: Record<'H' | 'F', string> = { H: 'Hunter', F: 'Farmer' };

function fmtDay(value: string | null) {
  if (!value) return 'hiç hareket yok';
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

export default async function InactiveCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ satici?: string; gun?: string; sirala?: string; yon?: string }>;
}) {
  await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');

  const params = await searchParams;
  const ownerFilter = String(params.satici ?? '').trim();
  const days = Math.min(365, Math.max(1, Number(params.gun) || LIVE_BOARD_RULES.inactiveOwnerDays));

  // Varsayılan: en uzun süredir hareketsiz olan başta (tek kişi filtresi yoksa da aynı).
  const sort: InactiveSort = isInactiveSort(params.sirala) ? params.sirala : 'gun';
  const dir: InactiveSortDir = params.yon === 'asc' || params.yon === 'desc'
    ? params.yon
    : INACTIVE_SORT_DEFAULT_DIR[sort];

  const all = await loadHunterFarmerActivity();
  const scoped = ownerFilter ? all.filter((row) => normalizeName(row.owner) === normalizeName(ownerFilter)) : all;
  const rows = sortInactiveRows(scoped.filter((row) => isInactiveRow(row, days)), sort, dir, ownerOrderCompare);
  const unmatched = scoped.filter((row) => !row.matched);
  const owners = Array.from(new Set(rows.map((row) => row.owner)));

  // Başlık linki: aynı kolona tekrar basınca yön döner, başka kolona basınca o kolonun
  // doğal yönüyle başlar (gün → en çok bekleyen, firma → A'dan Z'ye).
  const sortHref = (key: InactiveSort) => {
    const query = new URLSearchParams();
    if (ownerFilter) query.set('satici', ownerFilter);
    if (params.gun) query.set('gun', String(days));
    query.set('sirala', key);
    query.set('yon', key === sort ? (dir === 'asc' ? 'desc' : 'asc') : INACTIVE_SORT_DEFAULT_DIR[key]);
    return `/crm/hareketsiz?${query.toString()}`;
  };
  const sortMark = (key: InactiveSort) => (key === sort ? (dir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="iv-shell">
      <section className="iv-hero">
        <span className="iv-eyebrow">Operasyon · Hareketsiz Firmalar</span>
        <h1>{ownerFilter || 'Tüm satış ekibi'} <small className="iv-count">{rows.length.toLocaleString('tr-TR')} firma</small></h1>
        <p>
          Account Atama’da <b>Hunter</b> ya da <b>Farmer</b> olup <b>{days} gündür</b> üzerinde işlem
          olmayan firmalar. Planlanan (henüz yapılmamış) aksiyonlar hareket sayılmaz.
        </p>
      </section>

      <GhostFilterBar
        action="/crm/hareketsiz"
        className="iv-filter"
        fields={[
          { name: 'satici', label: 'Satıcı', value: ownerFilter, options: ownerOptions(OWNER_ORDER.filter((name) => !['İş Ortakları', 'Havuz Account', 'Yemek Kartları'].includes(name)), ownerFilter || null) },
          { name: 'gun', label: 'Hareketsizlik eşiği', value: String(days), options: Array.from(new Set([7, 15, 30, 60, 90, days])).sort((a, b) => a - b).map((value) => ({ value: String(value), label: `${value} gün` })) },
        ]}
        hidden={{ sirala: sort, yon: dir }}
      />

      <div className="iv-summary">
        <div><strong>{rows.length}</strong><span>hareketsiz firma</span></div>
        <div><strong>{owners.length}</strong><span>kişi</span></div>
        <div><strong>{scoped.length}</strong><span>Hunter + Farmer satırı</span></div>
      </div>

      {rows.length === 0 ? (
        <div className="iv-empty">Bu ölçüte uyan firma yok — {days} gün içinde hepsine dokunulmuş.</div>
      ) : (
        <div className="iv-table" role="table">
          <div className="iv-tr iv-th" role="row">
            <span role="columnheader" className="iv-no">#</span>
            {([
              ['firma', 'Firma'], ['kisi', 'Kişi'], ['kategori', 'Kategori'],
              ['tarih', 'Son hareket'], ['gun', 'Gün'],
            ] as Array<[InactiveSort, string]>).map(([key, label]) => (
              <span role="columnheader" key={key} aria-sort={key === sort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <Link className={`iv-sort${key === sort ? ' is-on' : ''}`} href={sortHref(key)}>
                  {label}<i>{sortMark(key)}</i>
                </Link>
              </span>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <div className="iv-tr" role="row" key={`${row.owner}-${row.category}-${row.firma}`}>
              <span role="cell" className="iv-no">{rowIndex + 1}</span>
              <span role="cell">
                {row.customerId
                  ? <Link href={`/crm/${row.customerId}`} target="_blank">{row.musteri ?? row.firma}</Link>
                  : row.firma}
              </span>
              <span role="cell">{row.owner}</span>
              <span role="cell"><i className={`iv-chip cat-${row.category}`}>{CATEGORY_LABEL[row.category]}</i></span>
              <span role="cell">{fmtDay(row.lastActivityAt)}</span>
              <span role="cell" className={`iv-days ${row.days == null || row.days >= days * 2 ? 'hot' : ''}`}>
                {row.days == null ? '—' : row.days}
              </span>
            </div>
          ))}
        </div>
      )}

      {unmatched.length ? (
        <div className="iv-note">
          <b>{unmatched.length} liste satırı</b> CRM künyesiyle eşleşmedi (ad farklı ya da firma kartı açılmamış);
          bu satırların aktivitesi bilinemediği için sayıya girmiyor:{' '}
          {unmatched.slice(0, 12).map((row) => row.firma).join(' · ')}
          {unmatched.length > 12 ? ` … +${unmatched.length - 12}` : ''}
        </div>
      ) : null}
    </div>
  );
}
