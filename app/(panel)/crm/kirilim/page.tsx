import Link from 'next/link';
import { getUserDepartments, requireCrmAccessOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';
import { loadDrilldown } from '@/lib/reports/drilldown';
import { DEVICE_MODE_LABEL, DRILLDOWN_KINDS, KIND_TITLE, QUOTE_STATES, QUOTE_STATE_LABEL, SELLER_SEGMENT_COLOR, parseDrilldownParams, type SellerSegment } from '@/lib/reports/drilldown-shared';
import { istanbulDayKey } from '@/lib/reports/live-board-shared';
import { yearOptions, type GhostFilterField } from '@/components/reports/GhostFilterBar';
import { parseFilters, type PageFilterConfig } from '@/lib/filters/schema';
import { ownerValueFromName, resolveOwner } from '@/lib/reports/owner-filter';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import { FilterBar } from '@/components/filters/FilterBar';
import '@/styles/drilldown.css';

// KIRILIM — Canlı Ekran kutularının arkası (15.09.2026).
// Çağdaş Bey: "her şey için linkleme istiyoruz" · "A80'e basınca kime kaç tane satmışız göreyim".
// Menüde YOKTUR: yalnız Canlı Ekran'daki kutulardan yeni sekmede açılır (Hareketsiz Firmalar ile
// aynı mantık). Tek sayfa, `?tip=` ile farklı liste: cihaz · teklif · kapsama · portfoy · poc · fatura.
// Kapı: Müşteriler ekranıyla aynı (customer.read + screen.crm.customers.view).
//
// 17.09 (Sinan, "hayalet ekranlara linkten gidince filtre ve sayı gelsin"): üstte filtre çubuğu
// (satıcı · yıl · tip · teklif durumu / cihaz modu — GET formu, JS'siz), başlıkta toplam kayıt
// sayısı, tabloda # kolonu. Canlı Ekran'daki kutuyla aynı sayı görünür; sayılmıyorsa fark hemen çıkar.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Kolon sıralama: sayı (faz "25 · …" gibi baştaki sayı dahil) sayısal, kalan Türkçe alfabetik; boşlar hep sonda. */
function compareCells(a: string | number | null, b: string | number | null) {
  const empty = (v: unknown) => v == null || v === '' || v === '—';
  if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : empty(a) ? 1 : -1;
  const num = (v: string | number) => (typeof v === 'number' ? v : /^-?\d+([.,]\d+)?(\s|$|·)/.test(v) ? parseFloat(v.replace(',', '.')) : NaN);
  const na = num(a!);
  const nb = num(b!);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'tr', { numeric: true });
}

function fmtDay(value: string | number | null) {
  if (value == null || value === '') return '—';
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
  const [y, m, d] = text.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export default async function DrilldownPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');

  const today = new Date();
  const currentYear = Number(istanbulDayKey(today).slice(0, 4));
  const raw = await searchParams;
  const params = parseDrilldownParams(raw, currentYear);
  // Satıcı: kullanıcı id (?owner=); Canlı Ekran'ın eski ad linkleri (?satisci=Ad) de çözülür.
  // customer.read.any yoksa kapsam kullanıcının kendisine sabitlenir. Drilldown sorguları ad bazlı.
  const ownerOpts = await loadOwnerOptions({ departments: await getUserDepartments(me) });
  const canSeeAll = userHasPermission(me, 'customer.read.any');
  const filterConfig: PageFilterConfig = {
    keys: ['owner'],
    options: { owner: canSeeAll ? ownerOpts : ownerOpts.filter((o) => o.value === String(me.id)) },
    labels: { owner: 'Satıcı (Account sahibi)' },
  };
  const one0 = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters = parseFilters({ owner: one0(raw.owner) ?? ownerValueFromName(params.owner, ownerOpts) }, filterConfig);
  if (!canSeeAll) filters.owner = String(me.id);
  params.owner = resolveOwner(filters.owner, ownerOpts)?.name ?? (canSeeAll ? null : String(me.full_name ?? me.email ?? ''));
  const data = await loadDrilldown(params, today);
  // Başlık okları: ?sirala=<kolon>&yon=artan|azalan (JS'siz link, diğer filtreler korunur).
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const sortKey = one(raw.sirala);
  const sortIndex = data.columns.findIndex((column) => column.key === sortKey);
  const sortDesc = one(raw.yon) === 'azalan';
  const rows = sortIndex < 0 ? data.rows : [...data.rows].sort((x, y) => {
    const a = x.cells[sortIndex] ?? null;
    const b = y.cells[sortIndex] ?? null;
    const empty = (v: unknown) => v == null || v === '' || v === '—';
    if (empty(a) || empty(b)) return compareCells(a, b);
    return sortDesc ? compareCells(b, a) : compareCells(a, b);
  });
  const sortHref = (key: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) if (k !== 'sirala' && k !== 'yon' && k !== 'satisci' && one(v)) qs.set(k, one(v));
    if (filters.owner && canSeeAll) qs.set('owner', filters.owner);
    qs.set('sirala', key);
    qs.set('yon', sortKey === key && !sortDesc ? 'azalan' : 'artan');
    return `/crm/kirilim?${qs}`;
  };
  const filterFields: GhostFilterField[] = [
    { name: 'tip', label: 'Liste', value: params.kind, options: DRILLDOWN_KINDS.map((kind) => ({ value: kind, label: KIND_TITLE[kind] })) },
    { name: 'yil', label: 'Yıl', value: String(params.year), options: yearOptions(currentYear, params.year) },
  ];
  if (params.kind === 'teklif') {
    filterFields.push({ name: 'durum', label: 'Durum', value: params.state ?? '', options: [{ value: '', label: 'Hepsi' }, ...QUOTE_STATES.map((state) => ({ value: state, label: QUOTE_STATE_LABEL[state] }))] });
  }
  if (params.kind === 'cihaz') {
    filterFields.push({ name: 'cihaz', label: 'Cihaz', value: params.mode ?? '', options: [{ value: '', label: 'Satılan + kiralanan' }, { value: 'sale', label: DEVICE_MODE_LABEL.sale }, { value: 'rental', label: DEVICE_MODE_LABEL.rental }] });
  }
  const dayColumns = new Set(data.columns.map((column, index) => (/tarih|son|başlangıç|baslangic|hedef|görüşme|gorusme/i.test(column.label) ? index : -1)).filter((index) => index >= 0));

  return (
    <div className="dd-shell">
      <section className="dd-hero">
        <span className="dd-eyebrow">Canlı Ekran · Kırılım</span>
        <h1>{data.title} <small className="dd-count">{data.rows.length.toLocaleString('tr-TR')} satır</small></h1>
        <p>{data.subtitle}</p>
      </section>

      <FilterBar
        mode="form"
        action="/crm/kirilim"
        config={filterConfig}
        values={filters}
        actions={(
          <>
            {params.kind === 'cihaz' && params.model ? <input type="hidden" name="model" value={params.model} /> : null}
            {params.model ? <span className="text-sm text-text-2">Model: <b>{params.model}</b></span> : null}
            {filterFields.map((field) => (
              <label key={field.name} className="flex items-center gap-1.5 text-sm text-text-2">
                {field.label}
                <select name={field.name} defaultValue={field.value} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm">
                  {field.options.map((option) => <option key={option.value || '__all'} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ))}
          </>
        )}
      />

      {data.segments ? (
        <nav className="dd-segs" aria-label="Takip etiketi">
          {[{ key: null as SellerSegment | null, count: data.segments.reduce((sum, seg) => sum + seg.count, 0) }, ...data.segments].map((seg) => {
            const qs = new URLSearchParams();
            qs.set('tip', params.kind);
            if (filters.owner && canSeeAll) qs.set('owner', filters.owner);
            qs.set('yil', String(params.year));
            if (seg.key) qs.set('etiket', seg.key.toLocaleLowerCase('tr'));
            const active = params.segment === seg.key;
            return (
              <Link key={seg.key ?? 'all'} href={`/crm/kirilim?${qs}`} className={`dd-seg${active ? ' active' : ''}`}>
                {seg.key ? <i style={{ background: SELLER_SEGMENT_COLOR[seg.key] }} /> : null}
                {seg.key ?? 'Tümü'} <b>{seg.count.toLocaleString('tr-TR')}</b>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="dd-summary">
        {data.stats.map((stat) => (
          <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <div className="dd-empty">Bu ölçüte uyan kayıt yok.</div>
      ) : (
        <div className="dd-table" role="table" style={{ ['--dd-cols' as string]: ['44px', ...data.columns.map((column) => column.width ?? 'minmax(0, 1.6fr)')].join(' ') }}>
          <div className="dd-tr dd-th" role="row">
            <span role="columnheader" className="right dd-no">#</span>
            {data.columns.map((column) => (
              <span key={column.key} role="columnheader" className={column.align === 'right' ? 'right' : ''}>
                <Link href={sortHref(column.key)} className={`dd-sort${sortKey === column.key ? ' active' : ''}`} title="Sırala">
                  {column.label} <i aria-hidden>{sortKey === column.key ? (sortDesc ? '▼' : '▲') : '⇅'}</i>
                </Link>
              </span>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <div className="dd-tr" role="row" key={`${row.customerId ?? 'row'}-${rowIndex}`}>
              <span role="cell" className="right dd-no">{rowIndex + 1}</span>
              {row.cells.map((cell, cellIndex) => (
                <span key={data.columns[cellIndex]?.key ?? cellIndex} role="cell" className={data.columns[cellIndex]?.align === 'right' ? 'right' : ''}>
                  {cellIndex === 0 && row.customerId
                    ? <Link href={`/crm/${row.customerId}`} target="_blank">{cell}</Link>
                    : data.columns[cellIndex]?.key === 'etiket' && cell
                      ? <span className="dd-tag"><i style={{ background: SELLER_SEGMENT_COLOR[cell as SellerSegment] }} />{cell}</span>
                    : dayColumns.has(cellIndex) ? fmtDay(cell) : (cell ?? '—')}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {data.note ? <div className="dd-note">{data.note}</div> : null}
    </div>
  );
}
