'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RetailOperasyonPayload, RetailOpportunity } from '@/lib/reports/retail-operasyon';

const ACCESSORY = new Set(['S210']);
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const nf = new Intl.NumberFormat('tr-TR');
const usdf = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

type Col<T> = { key: string; label: string; value: (r: T) => string | number | null; render?: (r: T) => ReactNode; num?: boolean };

function downloadCsv<T>(name: string, cols: Col<T>[], rows: T[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [cols.map((c) => esc(c.label)).join(';'), ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortTable<T>({ title, name, cols, rows, footer }: { title: string; name: string; cols: Col<T>[]; rows: T[]; footer?: ReactNode }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'tr') * sort.dir;
    });
  }, [rows, cols, sort]);
  return (
    <section className="ro-card">
      <div className="ro-card-head">
        <h3>{title} <small>({nf.format(rows.length)})</small></h3>
        <button type="button" className="ro-btn" onClick={() => downloadCsv(name, cols, sorted)}>CSV</button>
      </div>
      <div className="ro-scroll">
        <table className="ro-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={c.num ? 'num' : ''}
                  onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.num ? -1 : 1 }))}
                >
                  {c.label}
                  {sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} className={c.num ? 'num' : ''}>
                    {c.render ? c.render(r) : typeof c.value(r) === 'number' ? nf.format(c.value(r) as number) : c.value(r) ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={cols.length} className="ro-empty">Kayıt yok</td></tr>
            )}
          </tbody>
          {footer}
        </table>
      </div>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ro-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

type Agg = { key: string; qty: number; usd: number; rental: number };
function aggregate<T>(rows: T[], key: (r: T) => string, qty: (r: T) => number, usd: (r: T) => number, rental: (r: T) => number): Agg[] {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const k = key(r);
    const a = m.get(k) ?? { key: k, qty: 0, usd: 0, rental: 0 };
    a.qty += qty(r);
    a.usd += usd(r);
    a.rental += rental(r);
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.qty - a.qty);
}

const oppCols: Col<RetailOpportunity & { weighted: number }>[] = [
  { key: 'firm', label: 'Firma', value: (r) => r.firm },
  { key: 'model', label: 'Model', value: (r) => r.model },
  { key: 'qty', label: 'Adet', value: (r) => r.qty, num: true },
  { key: 'month', label: 'Ay', value: (r) => r.month, render: (r) => MONTHS[r.month - 1] ?? '-' },
  { key: 'channel', label: 'İş modeli', value: (r) => r.channel },
  { key: 'prob', label: 'Olasılık %', value: (r) => r.prob, num: true },
  { key: 'weighted', label: 'Senaryo adet', value: (r) => r.weighted, num: true },
  { key: 'owner', label: 'Sorumlu', value: (r) => r.owner },
  { key: 'note', label: 'Not', value: (r) => r.note },
];

function useScenario(opps: RetailOpportunity[], pct: number, weighted: boolean) {
  return useMemo(
    () =>
      opps.map((o) => ({
        ...o,
        weighted: Math.round(o.qty * (pct / 100) * (weighted ? o.prob / 100 : 1)),
      })),
    [opps, pct, weighted],
  );
}

function ScenarioBar({ pct, setPct, weighted, setWeighted }: { pct: number; setPct: (n: number) => void; weighted: boolean; setWeighted: (b: boolean) => void }) {
  return (
    <div className="ro-scenario">
      <label>
        Senaryo gerçekleşme %
        <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        <b>%{pct}</b>
      </label>
      <label className="ro-check">
        <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
        Olasılıkla ağırlıklandır
      </label>
    </div>
  );
}

function MonthlyResult({ title, actual, forecast, refMonth }: { title: string; actual: number[]; forecast: number[]; refMonth: number }) {
  let cum = 0;
  const cells = MONTHS.map((_, i) => {
    const isActual = i <= refMonth;
    const v = isActual ? actual[i] : forecast[i];
    cum += v;
    return { v, cum, isActual };
  });
  const total = cells.reduce((s, c) => s + c.v, 0);
  return (
    <section className="ro-card">
      <div className="ro-card-head">
        <h3>{title}</h3>
        <span className="ro-legend"><i className="ok" /> Gerçekleşen <i className="fc" /> Tahmin</span>
      </div>
      <div className="ro-scroll">
        <table className="ro-table ro-month">
          <thead>
            <tr><th />{MONTHS.map((m) => <th key={m} className="num">{m}</th>)}<th className="num">Toplam</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Terminal</td>
              {cells.map((c, i) => <td key={i} className={`num ${c.isActual ? 'ok' : 'fc'}`}>{nf.format(c.v)}</td>)}
              <td className="num"><b>{nf.format(total)}</b></td>
            </tr>
            <tr>
              <td>Kümülatif</td>
              {cells.map((c, i) => <td key={i} className={`num ${c.isActual ? 'ok' : 'fc'}`}>{nf.format(c.cum)}</td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

const TABS = ['Mevcut durum', 'yıl sonu', 'next', 'CRM havuzu', 'sonuç', 'next sonuç'] as const;

export default function RetailOperasyonClient() {
  const [data, setData] = useState<RetailOperasyonPayload | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [pct, setPct] = useState(100);
  const [weighted, setWeighted] = useState(true);
  const [pctNext, setPctNext] = useState(100);
  const [weightedNext, setWeightedNext] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/reports/retail-operasyon', { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.message || 'Veri alınamadı');
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, []);

  const oppNow = useScenario(data?.opportunities.current ?? [], pct, weighted);
  const oppNext = useScenario(data?.opportunities.next ?? [], pctNext, weightedNext);

  const calc = useMemo(() => {
    const sales = data?.sales ?? [];
    const terminal = sales.filter((s) => !ACCESSORY.has(s.model));
    const qty = terminal.reduce((s, x) => s + x.qty, 0);
    const rental = terminal.filter((s) => s.saleType === 'rental').reduce((s, x) => s + x.qty, 0);
    const usd = sales.reduce((s, x) => s + x.usd, 0);
    const byModel = aggregate(sales, (s) => s.model, (s) => (ACCESSORY.has(s.model) ? 0 : s.qty), (s) => s.usd, (s) => (s.saleType === 'rental' ? s.qty : 0));
    const byFirm = aggregate(terminal, (s) => s.firm, (s) => s.qty, (s) => s.usd, (s) => (s.saleType === 'rental' ? s.qty : 0));
    const monthly = MONTHS.map((_, i) => terminal.filter((s) => s.month === i + 1).reduce((a, x) => a + x.qty, 0));
    return { qty, rental, usd, byModel, byFirm, monthly };
  }, [data]);

  const now = new Date();
  const year = data?.year ?? now.getFullYear();
  const refMonth = year < now.getFullYear() ? 11 : year > now.getFullYear() ? -1 : now.getMonth();

  const forecastMonthly = (rows: Array<{ month: number; weighted: number }>) =>
    MONTHS.map((_, i) => rows.filter((r) => r.month === i + 1).reduce((a, r) => a + r.weighted, 0));

  const futureNow = oppNow.filter((o) => o.month - 1 > refMonth);
  const futureQty = futureNow.reduce((a, o) => a + o.weighted, 0);
  const nextQty = oppNext.reduce((a, o) => a + o.weighted, 0);

  const crmRows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr-TR');
    const rows = data?.crm ?? [];
    if (!term) return rows;
    return rows.filter((r) => [r.name, r.sector, r.kasa, r.owner, r.status, r.pos, r.banks].join(' ').toLocaleLowerCase('tr-TR').includes(term));
  }, [data, q]);

  const tabLabel = (i: number) =>
    i === 1 ? `${year} yıl sonu` : i === 2 ? `${year + 1}` : i === 4 ? `${year} sonuç` : i === 5 ? `${year + 1} sonuç` : TABS[i];

  const aggCols: Col<Agg>[] = [
    { key: 'key', label: 'Ad', value: (r) => r.key },
    { key: 'qty', label: 'Terminal', value: (r) => r.qty, num: true },
    { key: 'rental', label: 'Kiralama', value: (r) => r.rental, num: true },
    { key: 'usd', label: 'Ciro (USD)', value: (r) => Math.round(r.usd), render: (r) => usdf.format(r.usd), num: true },
  ];

  return (
    <div className="ro-root">
      <style>{CSS}</style>
      <header className="ro-header">
        <div>
          <h1>Retail Operasyon Paneli</h1>
          <p>Canlı CRM verisi · {data ? new Date(data.generatedAt).toLocaleString('tr-TR') : 'yükleniyor…'}</p>
        </div>
        <nav className="ro-tabs">
          {TABS.map((_, i) => (
            <button key={i} type="button" className={tab === i ? 'active' : ''} onClick={() => setTab(i)}>{tabLabel(i)}</button>
          ))}
        </nav>
      </header>

      {error && <div className="ro-error">{error}</div>}
      {!data && !error && <div className="ro-empty">Yükleniyor…</div>}

      {data && tab === 0 && (
        <>
          <div className="ro-kpis">
            <Kpi label={`${year} terminal`} value={nf.format(calc.qty)} sub={`${nf.format(calc.rental)} kiralama`} />
            <Kpi label={`${year} ciro`} value={usdf.format(calc.usd)} sub="S210 dahil" />
            <Kpi label="KasaPOS aktif kasa" value={nf.format(data.kasapos.aktifKasa)} />
            <Kpi label="Faturalanan" value={nf.format(data.kasapos.faturalanan)} sub={data.kasapos.refMonth ?? ''} />
            <Kpi label="Aylık gelir" value={usdf.format(data.kasapos.aylikGelir)} />
            <Kpi label="Fırsat kasa" value={nf.format(data.kasapos.firsat)} sub={`Potansiyel ${usdf.format(data.kasapos.potansiyel)}`} />
          </div>
          <MonthlyResult title={`${year} aylık terminal`} actual={calc.monthly} forecast={forecastMonthly(oppNow)} refMonth={refMonth} />
          <div className="ro-grid2">
            <SortTable title="Model bazlı" name={`retail-model-${year}`} cols={aggCols} rows={calc.byModel} />
            <SortTable title="Firma bazlı" name={`retail-firma-${year}`} cols={aggCols} rows={calc.byFirm} />
          </div>
          <SortTable
            title="KasaPOS faturalama"
            name={`retail-kasapos-${year}`}
            rows={data.kasapos.rows}
            cols={[
              { key: 'firm', label: 'Firma', value: (r) => r.firm },
              { key: 'active', label: 'Aktif kasa', value: (r) => r.active, num: true },
              { key: 'billed', label: 'Faturalanan', value: (r) => r.billed, num: true },
              { key: 'gap', label: 'Fark', value: (r) => r.gap, num: true },
              { key: 'rate', label: 'Kullanım %', value: (r) => r.rate, num: true },
            ]}
          />
        </>
      )}

      {data && tab === 1 && (
        <>
          <ScenarioBar pct={pct} setPct={setPct} weighted={weighted} setWeighted={setWeighted} />
          <div className="ro-kpis">
            <Kpi label="Gerçekleşen" value={nf.format(calc.qty)} />
            <Kpi label="Kalan aylar senaryo" value={nf.format(futureQty)} />
            <Kpi label={`${year} yıl sonu tahmini`} value={nf.format(calc.qty + futureQty)} />
            <Kpi label="Toplam fırsat" value={nf.format(data.opportunities.current.reduce((a, o) => a + o.qty, 0))} sub={`${nf.format(oppNow.length)} kayıt`} />
          </div>
          <SortTable title={`${year} fırsatları`} name={`retail-firsat-${year}`} cols={oppCols} rows={oppNow} />
        </>
      )}

      {data && tab === 2 && (
        <>
          <ScenarioBar pct={pctNext} setPct={setPctNext} weighted={weightedNext} setWeighted={setWeightedNext} />
          <div className="ro-kpis">
            <Kpi label={`${year + 1} senaryo`} value={nf.format(nextQty)} />
            <Kpi label="Toplam fırsat" value={nf.format(data.opportunities.next.reduce((a, o) => a + o.qty, 0))} sub={`${nf.format(oppNext.length)} kayıt`} />
          </div>
          <SortTable title={`${year + 1} fırsatları`} name={`retail-firsat-${year + 1}`} cols={oppCols} rows={oppNext} />
        </>
      )}

      {data && tab === 3 && (
        <>
          <input className="ro-search" placeholder="Firma, sektör, kasa, POS, banka ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          <SortTable
            title="CRM havuzu"
            name="retail-crm-havuzu"
            rows={crmRows}
            cols={[
              { key: 'name', label: 'Firma', value: (r) => r.name },
              { key: 'sector', label: 'Sektör', value: (r) => r.sector },
              { key: 'kasa', label: 'Kasa firması', value: (r) => r.kasa },
              { key: 'register', label: 'Kasa adedi', value: (r) => r.register, num: true },
              { key: 'pos', label: 'POS markası', value: (r) => r.pos },
              { key: 'posOwner', label: 'POS mülkiyet', value: (r) => r.posOwner },
              { key: 'banks', label: 'Bankalar', value: (r) => r.banks },
              { key: 'status', label: 'Faz', value: (r) => r.status },
              { key: 'owner', label: 'Sorumlu', value: (r) => r.owner },
            ]}
          />
        </>
      )}

      {data && tab === 4 && (
        <>
          <ScenarioBar pct={pct} setPct={setPct} weighted={weighted} setWeighted={setWeighted} />
          <MonthlyResult title={`${year} sonuç — gerçekleşen + senaryo`} actual={calc.monthly} forecast={forecastMonthly(oppNow)} refMonth={refMonth} />
        </>
      )}

      {data && tab === 5 && (
        <>
          <ScenarioBar pct={pctNext} setPct={setPctNext} weighted={weightedNext} setWeighted={setWeightedNext} />
          <MonthlyResult title={`${year + 1} sonuç — senaryo`} actual={MONTHS.map(() => 0)} forecast={forecastMonthly(oppNext)} refMonth={-1} />
        </>
      )}
    </div>
  );
}

const CSS = `
.ro-root{padding:20px;display:flex;flex-direction:column;gap:16px;color:var(--text,#0f172a)}
.ro-header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-end}
.ro-header h1{margin:0;font-size:22px}.ro-header p{margin:4px 0 0;color:#64748b;font-size:13px}
.ro-tabs{display:flex;flex-wrap:wrap;gap:6px}
.ro-tabs button,.ro-btn{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
.ro-tabs button.active{background:#0f172a;color:#fff;border-color:#0f172a}
.ro-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.ro-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.ro-kpi span{font-size:12px;color:#64748b}.ro-kpi strong{font-size:22px}.ro-kpi small{font-size:12px;color:#94a3b8}
.ro-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;min-width:0}
.ro-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.ro-card-head h3{margin:0;font-size:15px}.ro-card-head small{color:#94a3b8;font-weight:400}
.ro-scroll{overflow:auto;max-height:560px}
.ro-table{width:100%;border-collapse:collapse;font-size:13px}
.ro-table th{position:sticky;top:0;background:#f8fafc;text-align:left;padding:6px 8px;cursor:pointer;white-space:nowrap;border-bottom:1px solid #e2e8f0}
.ro-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9}
.ro-table .num{text-align:right;font-variant-numeric:tabular-nums}
.ro-month td.ok{background:#dcfce7}.ro-month td.fc{background:#fef9c3}
.ro-legend{font-size:12px;color:#64748b;display:flex;gap:6px;align-items:center}
.ro-legend i{display:inline-block;width:12px;height:12px;border-radius:3px}.ro-legend i.ok{background:#bbf7d0}.ro-legend i.fc{background:#fef08a}
.ro-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px}
.ro-scenario{display:flex;flex-wrap:wrap;gap:20px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:13px}
.ro-scenario label{display:flex;gap:8px;align-items:center}
.ro-search{border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;font-size:14px;max-width:420px}
.ro-error{background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:8px}
.ro-empty{color:#94a3b8;text-align:center;padding:16px}
@media (max-width:640px){.ro-root{padding:12px}.ro-grid2{grid-template-columns:1fr}}
`;
