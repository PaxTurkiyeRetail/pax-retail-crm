import Link from 'next/link';
import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { loadDrilldown } from '@/lib/reports/drilldown';
import { parseDrilldownParams } from '@/lib/reports/drilldown-shared';
import { istanbulDayKey } from '@/lib/reports/live-board-shared';
import '@/styles/drilldown.css';

// KIRILIM — Canlı Ekran kutularının arkası (15.09.2026).
// Çağdaş Bey: "her şey için linkleme istiyoruz" · "A80'e basınca kime kaç tane satmışız göreyim".
// Menüde YOKTUR: yalnız Canlı Ekran'daki kutulardan yeni sekmede açılır (Hareketsiz Firmalar ile
// aynı mantık). Tek sayfa, `?tip=` ile farklı liste: cihaz · teklif · kapsama · portfoy · poc · fatura.
// Kapı: Müşteriler ekranıyla aynı (customer.read + screen.crm.customers.view).

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
  const params = parseDrilldownParams(await searchParams, Number(istanbulDayKey(today).slice(0, 4)));
  const data = await loadDrilldown(params, today);
  const dayColumns = new Set(data.columns.map((column, index) => (/tarih|son|başlangıç|baslangic|hedef|görüşme|gorusme/i.test(column.label) ? index : -1)).filter((index) => index >= 0));

  return (
    <div className="dd-shell">
      <section className="dd-hero">
        <span className="dd-eyebrow">Canlı Ekran · Kırılım</span>
        <h1>{data.title}</h1>
        <p>{data.subtitle}</p>
      </section>

      <div className="dd-summary">
        {data.stats.map((stat) => (
          <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <div className="dd-empty">Bu ölçüte uyan kayıt yok.</div>
      ) : (
        <div className="dd-table" role="table" style={{ ['--dd-cols' as string]: data.columns.map((column) => column.width ?? 'minmax(0, 1.6fr)').join(' ') }}>
          <div className="dd-tr dd-th" role="row">
            {data.columns.map((column) => (
              <span key={column.key} role="columnheader" className={column.align === 'right' ? 'right' : ''}>{column.label}</span>
            ))}
          </div>
          {data.rows.map((row, rowIndex) => (
            <div className="dd-tr" role="row" key={`${row.customerId ?? 'row'}-${rowIndex}`}>
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
