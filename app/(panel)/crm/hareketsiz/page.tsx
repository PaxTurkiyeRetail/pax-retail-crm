import Link from 'next/link';
import { getUserDepartments, requireCrmAccessOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';
import { isInactiveRow, loadHunterFarmerActivity } from '@/lib/reports/inactive-customers';
import {
  INACTIVE_SORT_DEFAULT_DIR, isInactiveSort, sortInactiveRows,
  type InactiveSort, type InactiveSortDir,
} from '@/lib/reports/inactive-customers-shared';
import { LIVE_BOARD_RULES, normalizeName, ownerOrderCompare } from '@/lib/reports/live-board-shared';
import { parseFilters, type PageFilterConfig } from '@/lib/filters/schema';
import { ownerValueFromName, resolveOwner } from '@/lib/reports/owner-filter';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import { FilterBar } from '@/components/filters/FilterBar';
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

const CATEGORY_LABEL: Record<'H' | 'F' | 'L' | 'K', string> = { H: 'Hunter', F: 'Farmer', L: 'Lead', K: 'Kasa' };

function fmtDay(value: string | null) {
  if (!value) return 'hiç hareket yok';
  const [y, m, d] = value.split('-');
  return `${d}.${m}.${y}`;
}

export default async function InactiveCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; satici?: string; gun?: string; sirala?: string; yon?: string }>;
}) {
  const me = await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');

  const params = await searchParams;
  // Satıcı: kullanıcı id (?owner=); Canlı Ekran'ın eski ad linkleri (?satici=Ad) de çözülür.
  // customer.read.any yoksa kapsam kullanıcının kendisine sabitlenir.
  const ownerOpts = await loadOwnerOptions({ departments: await getUserDepartments(me), includePseudo: false });
  const canSeeAll = userHasPermission(me, 'customer.read.any');
  const filterConfig: PageFilterConfig = {
    keys: ['owner'],
    options: { owner: canSeeAll ? ownerOpts : ownerOpts.filter((o) => o.value === String(me.id)) },
    labels: { owner: 'Satıcı (Account sahibi)' },
  };
  const filters = parseFilters({ owner: params.owner ?? ownerValueFromName(params.satici, ownerOpts) }, filterConfig);
  if (!canSeeAll) filters.owner = String(me.id);
  const ownerFilter = resolveOwner(filters.owner, ownerOpts)?.name ?? (canSeeAll ? '' : String(me.full_name ?? me.email ?? ''));
  const days = Math.min(365, Math.max(1, Number(params.gun) || LIVE_BOARD_RULES.inactiveOwnerDays));

  // Varsayılan: en uzun süredir hareketsiz olan başta (tek kişi filtresi yoksa da aynı).
  const sort: InactiveSort = isInactiveSort(params.sirala) ? params.sirala : 'gun';
  const dir: InactiveSortDir = params.yon === 'asc' || params.yon === 'desc'
    ? params.yon
    : INACTIVE_SORT_DEFAULT_DIR[sort];

  const all = await loadHunterFarmerActivity();
  const ownerId = filters.owner && !filters.owner.startsWith('n-') ? filters.owner : null;
  const scoped = ownerFilter
    ? all.filter((row) => (ownerId && row.ownerUserId === ownerId) || normalizeName(row.owner) === normalizeName(ownerFilter))
    : all;
  const rows = sortInactiveRows(scoped.filter((row) => isInactiveRow(row, days)), sort, dir, ownerOrderCompare);
  const unmatched = scoped.filter((row) => !row.matched);
  const owners = Array.from(new Set(rows.map((row) => row.owner)));

  // Başlık linki: aynı kolona tekrar basınca yön döner, başka kolona basınca o kolonun
  // doğal yönüyle başlar (gün → en çok bekleyen, firma → A'dan Z'ye).
  const sortHref = (key: InactiveSort) => {
    const query = new URLSearchParams();
    if (filters.owner && canSeeAll) query.set('owner', filters.owner);
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

      <FilterBar
        mode="form"
        action="/crm/hareketsiz"
        config={filterConfig}
        values={filters}
        actions={(
          <>
            <input type="hidden" name="sirala" value={sort} />
            <input type="hidden" name="yon" value={dir} />
            <label className="flex items-center gap-1.5 text-sm text-text-2">
              Hareketsizlik eşiği
              <select name="gun" defaultValue={String(days)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">
                {Array.from(new Set([7, 15, 30, 60, 90, days])).sort((a, b) => a - b).map((value) => (
                  <option key={value} value={String(value)}>{value} gün</option>
                ))}
              </select>
            </label>
          </>
        )}
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
