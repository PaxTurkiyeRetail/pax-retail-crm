import Link from 'next/link';
import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { loadDrilldown } from '@/lib/reports/drilldown';
import { DEVICE_MODE_LABEL, DRILLDOWN_KINDS, KIND_TITLE, QUOTE_STATES, QUOTE_STATE_LABEL, parseDrilldownParams } from '@/lib/reports/drilldown-shared';
import { OWNER_ORDER, istanbulDayKey } from '@/lib/reports/live-board-shared';
import { GhostFilterBar, ownerOptions, yearOptions, type GhostFilterField } from '@/components/reports/GhostFilterBar';
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
  await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');

  const today = new Date();
  const currentYear = Number(istanbulDayKey(today).slice(0, 4));
  const params = parseDrilldownParams(await searchParams, currentYear);
  const data = await loadDrilldown(params, today);
  const filterFields: GhostFilterField[] = [
    { name: 'tip', label: 'Liste', value: params.kind, options: DRILLDOWN_KINDS.map((kind) => ({ value: kind, label: KIND_TITLE[kind] })) },
    { name: 'satisci', label: 'Satıcı', value: params.owner ?? '', options: ownerOptions(OWNER_ORDER, params.owner) },
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

      <GhostFilterBar
        action="/crm/kirilim"
        className="dd-filter"
        fields={filterFields}
        hidden={{ model: params.kind === 'cihaz' ? params.model : null }}
      >
        {params.model ? <span className="dd-filter-note">Model: <b>{params.model}</b> (linkten geldi; tüm modeller için listeyi yeniden seçip uygula)</span> : null}
      </GhostFilterBar>

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
              <span key={column.key} role="columnheader" className={column.align === 'right' ? 'right' : ''}>{column.label}</span>
            ))}
          </div>
          {data.rows.map((row, rowIndex) => (
            <div className="dd-tr" role="row" key={`${row.customerId ?? 'row'}-${rowIndex}`}>
              <span role="cell" className="right dd-no">{rowIndex + 1}</span>
              {row.cells.map((cell, cellIndex) => (
                <span key={data.columns[cellIndex]?.key ?? cellIndex} role="cell" className={data.columns[cellIndex]?.align === 'right' ? 'right' : ''}>
                  {cellIndex === 0 && row.customerId
                    ? <Link href={`/crm/${row.customerId}`} target="_blank">{cell}</Link>
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
