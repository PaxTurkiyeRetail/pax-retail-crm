'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RetailOperasyonPayload, RetailOpportunity } from '@/lib/reports/retail-operasyon';
import ForecastQuickAdd, { loadForecastQuickAddOptions, type ForecastQuickAddOptions } from '@/components/forecast/ForecastQuickAdd';
import { Checkbox, DataTable, Field, Input, Notice, Range, KpiStrip, Page, PageHeader, Section, Tabs, Toolbar, cn, numCls, td, th, type Column } from '@/components/ui';

const ACCESSORY = new Set(['S210']);
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const nf = new Intl.NumberFormat('tr-TR');
const usdf = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

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

type Opp = RetailOpportunity & { weighted: number };
const oppCols: Column<Opp>[] = [
  { key: 'firm', label: 'Firma', value: (r) => r.firm },
  { key: 'model', label: 'Model', value: (r) => r.model },
  { key: 'qty', label: 'Adet', value: (r) => r.qty, num: true },
  { key: 'month', label: 'Ay', value: (r) => r.month, render: (r) => MONTHS[r.month - 1] ?? '–' },
  { key: 'saleType', label: 'Tip', value: (r) => (r.saleType === 'rental' ? 'Kiralama' : 'Satış'), badge: (r) => (r.saleType === 'rental' ? 'c2' : 'c1') },
  { key: 'channel', label: 'Kanal', value: (r) => r.channel },
  { key: 'prob', label: 'Olasılık %', value: (r) => r.prob, num: true, cellClass: (r) => cn('font-semibold', r.prob >= 70 ? 'text-ok' : r.prob >= 40 ? 'text-warn' : 'text-danger') },
  { key: 'weighted', label: 'Senaryo adet', value: (r) => r.weighted, num: true },
  { key: 'owner', label: 'Sorumlu', value: (r) => r.owner },
  { key: 'note', label: 'Not', value: (r) => r.note },
];

const aggCols: Column<Agg>[] = [
  { key: 'key', label: 'Ad', value: (r) => r.key },
  { key: 'qty', label: 'Terminal', value: (r) => r.qty, num: true },
  { key: 'rental', label: 'Kiralama', value: (r) => r.rental, num: true },
  { key: 'usd', label: 'Ciro (USD)', value: (r) => Math.round(r.usd), render: (r) => usdf.format(r.usd), num: true },
];

function useScenario(opps: RetailOpportunity[], pct: number, weighted: boolean): Opp[] {
  return useMemo(() => opps.map((o) => ({ ...o, weighted: Math.round(o.qty * (pct / 100) * (weighted ? o.prob / 100 : 1)) })), [opps, pct, weighted]);
}

function ScenarioBar({ pct, setPct, weighted, setWeighted }: { pct: number; setPct: (n: number) => void; weighted: boolean; setWeighted: (b: boolean) => void }) {
  return (
    <Toolbar>
      <Field label="Senaryo gerçekleşme">
        <Range min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        <b className="w-10 tabular-nums">%{pct}</b>
      </Field>
      <Checkbox label="Olasılıkla ağırlıklandır" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
    </Toolbar>
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
  const tone = (a: boolean) => (a ? 'bg-ok-soft text-ok font-semibold' : 'bg-warn-soft text-warn font-semibold');
  return (
    <Section
      title={title}
      actions={
        <span className="flex items-center gap-3 text-xs text-text-3">
          <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-ok" />Gerçekleşen</span>
          <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-warn" />Tahmin</span>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] leading-5 text-text-2">
          <thead>
            <tr>
              <th className={th} />
              {MONTHS.map((m) => <th key={m} className={cn(th, 'text-right')}>{m}</th>)}
              <th className={cn(th, 'text-right')}>Toplam</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-row-hover">
              <td className={cn(td, 'font-medium text-text')}>Terminal</td>
              {cells.map((c, i) => <td key={i} className={cn(td, numCls, tone(c.isActual))}>{nf.format(c.v)}</td>)}
              <td className={cn(td, numCls, 'font-semibold text-text')}>{nf.format(total)}</td>
            </tr>
            <tr className="hover:bg-row-hover">
              <td className={cn(td, 'font-medium text-text')}>Kümülatif</td>
              {cells.map((c, i) => <td key={i} className={cn(td, numCls, tone(c.isActual))}>{nf.format(c.cum)}</td>)}
              <td className={td} />
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

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

  // Forecast'te "Retail planı: Hariç" işaretli kayıtlar panele girmez.
  const planNow = useMemo(() => (data?.opportunities.current ?? []).filter((o) => o.includeInRetailPlan !== false), [data]);
  const planNext = useMemo(() => (data?.opportunities.next ?? []).filter((o) => o.includeInRetailPlan !== false), [data]);
  const oppNow = useScenario(planNow, pct, weighted);
  const oppNext = useScenario(planNext, pctNext, weightedNext);
  const [quickOptions, setQuickOptions] = useState<ForecastQuickAddOptions | null>(null);
  useEffect(() => {
    if (tab === 3 && !quickOptions) loadForecastQuickAddOptions().then(setQuickOptions).catch(() => undefined);
  }, [tab, quickOptions]);
  const reload = () => {
    fetch('/api/reports/retail-operasyon', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setData(j));
  };

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
  const forecastMonthly = (rows: Opp[]) => MONTHS.map((_, i) => rows.filter((r) => r.month === i + 1).reduce((a, r) => a + r.weighted, 0));

  const futureQty = oppNow.filter((o) => o.month - 1 > refMonth).reduce((a, o) => a + o.weighted, 0);
  const nextQty = oppNext.reduce((a, o) => a + o.weighted, 0);

  const crmRows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr-TR');
    const rows = data?.crm ?? [];
    if (!term) return rows;
    return rows.filter((r) => [r.name, r.sector, r.kasa, r.owner, r.status, r.pos, r.banks].join(' ').toLocaleLowerCase('tr-TR').includes(term));
  }, [data, q]);

  const tabs = [
    { key: 0, label: 'Mevcut durum' },
    { key: 1, label: `${year} yıl sonu` },
    { key: 2, label: `${year + 1}` },
    { key: 3, label: 'CRM havuzu' },
    { key: 4, label: `${year} sonuç` },
    { key: 5, label: `${year + 1} sonuç` },
  ];
  const loading = !data && !error;

  return (
    <Page>
      <PageHeader title="Retail Operasyon" meta={<>Canlı CRM verisi · {data ? new Date(data.generatedAt).toLocaleString('tr-TR') : 'yükleniyor…'}</>} />
      <Tabs items={tabs} value={tab} onChange={setTab} />

      {error && <Notice>{error}</Notice>}

      {tab === 0 && (
        <>
          <KpiStrip
            items={[
              { label: `${year} terminal`, value: data ? nf.format(calc.qty) : '–', sub: data && `${nf.format(calc.rental)} kiralama` },
              { label: `${year} ciro`, value: data ? usdf.format(calc.usd) : '–', sub: 'S210 dahil' },
              { label: 'KasaPOS aktif kasa', value: data ? nf.format(data.kasapos.aktifKasa) : '–' },
              { label: 'Faturalanan', value: data ? nf.format(data.kasapos.faturalanan) : '–', sub: data?.kasapos.refMonth ?? undefined },
              { label: 'Aylık gelir', value: data ? usdf.format(data.kasapos.aylikGelir) : '–' },
              { label: 'Fırsat kasa', tone: 'warn', value: data ? nf.format(data.kasapos.firsat) : '–', sub: data && `Potansiyel ${usdf.format(data.kasapos.potansiyel)}` },
            ]}
          />
          <MonthlyResult title={`${year} aylık terminal`} actual={calc.monthly} forecast={forecastMonthly(oppNow)} refMonth={refMonth} />
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 xl:grid-cols-2">
            <DataTable title="Model bazlı" csvName={`retail-model-${year}`} columns={aggCols} rows={calc.byModel} loading={loading} />
            <DataTable title="Firma bazlı" csvName={`retail-firma-${year}`} columns={aggCols} rows={calc.byFirm} loading={loading} />
          </div>
          <DataTable
            title="KasaPOS faturalama"
            csvName={`retail-kasapos-${year}`}
            loading={loading}
            rows={data?.kasapos.rows ?? []}
            columns={[
              { key: 'firm', label: 'Firma', value: (r) => r.firm },
              { key: 'active', label: 'Aktif kasa', value: (r) => r.active, num: true },
              { key: 'billed', label: 'Faturalanan', value: (r) => r.billed, num: true },
              { key: 'gap', label: 'Fark', value: (r) => r.gap, num: true, cellClass: (r) => ((r.gap ?? 0) > 0 ? 'text-danger' : undefined) },
              { key: 'rate', label: 'Kullanım %', value: (r) => r.rate, num: true },
            ]}
          />
          <KpiStrip
            items={[
              { label: 'Aktif kiralama', value: data?.rental ? nf.format(data.rental.activeQty) : '–' },
              { label: 'Kiralama aylık gelir', value: data?.rental ? usdf.format(data.rental.monthlyRevenue) : '–' },
              { label: 'Ort. aylık bedel', value: data?.rental?.avgMonthlyPrice != null ? usdf.format(data.rental.avgMonthlyPrice) : '–' },
              ...(data?.rental?.byStatus ?? []).filter((b) => b.contracts > 0 && b.status !== 'aktif').map((b) => ({ label: b.label, value: nf.format(b.qty), sub: `${b.contracts} sözleşme` })),
            ]}
          />
          <DataTable
            title="Kiralama durumu"
            csvName={`retail-kiralama-${year}`}
            loading={loading}
            rows={data?.rental?.contracts ?? []}
            emptyText="Kiralama kaydı yok — Satışlar ekranında satır tipini Kiralama seçin."
            columns={[
              { key: 'firm', label: 'Firma', value: (r) => r.firm },
              { key: 'status', label: 'Durum', value: (r) => r.statusLabel, badge: true },
              { key: 'qty', label: 'Adet', value: (r) => r.qty, num: true },
              { key: 'monthly', label: 'Aylık (USD)', value: (r) => r.monthly, render: (r) => usdf.format(r.monthly), num: true },
              { key: 'start', label: 'Başlangıç', value: (r) => r.start?.slice(0, 10) ?? '' },
              { key: 'note', label: 'Not', value: (r) => r.note },
            ]}
          />
        </>
      )}

      {tab === 1 && (
        <>
          <ScenarioBar pct={pct} setPct={setPct} weighted={weighted} setWeighted={setWeighted} />
          <KpiStrip
            items={[
              { label: 'Gerçekleşen', value: nf.format(calc.qty), tone: 'ok' },
              { label: 'Kalan aylar senaryo', value: nf.format(futureQty), tone: 'warn' },
              { label: `${year} yıl sonu tahmini`, value: nf.format(calc.qty + futureQty), tone: 'c1' },
              { label: 'Toplam fırsat', tone: 'warn', value: nf.format((data?.opportunities.current ?? []).reduce((a, o) => a + o.qty, 0)), sub: `${nf.format(oppNow.length)} kayıt` },
            ]}
          />
          <DataTable title={`${year} fırsatları`} csvName={`retail-firsat-${year}`} columns={oppCols} rows={oppNow} loading={loading} tall />
        </>
      )}

      {tab === 2 && (
        <>
          <ScenarioBar pct={pctNext} setPct={setPctNext} weighted={weightedNext} setWeighted={setWeightedNext} />
          <KpiStrip
            items={[
              { label: `${year + 1} senaryo`, value: nf.format(nextQty) },
              { label: 'Toplam fırsat', tone: 'warn', value: nf.format((data?.opportunities.next ?? []).reduce((a, o) => a + o.qty, 0)), sub: `${nf.format(oppNext.length)} kayıt` },
            ]}
          />
          <DataTable title={`${year + 1} fırsatları`} csvName={`retail-firsat-${year + 1}`} columns={oppCols} rows={oppNext} loading={loading} tall />
        </>
      )}

      {tab === 3 && (
        <>
          <Toolbar>
            <Input className="w-full sm:w-[360px]" placeholder="Firma, sektör, kasa, POS, banka ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Toolbar>
          <DataTable
            title="CRM havuzu"
            csvName="retail-crm-havuzu"
            loading={loading}
            tall
            rows={crmRows}
            columns={[
              { key: 'name', label: 'Firma', value: (r) => r.name },
              { key: 'sector', label: 'Sektör', value: (r) => r.sector },
              { key: 'kasa', label: 'Kasa firması', value: (r) => r.kasa },
              { key: 'register', label: 'Kasa adedi', value: (r) => r.register, num: true },
              { key: 'pos', label: 'POS markası', value: (r) => r.pos },
              { key: 'posOwner', label: 'POS mülkiyet', value: (r) => r.posOwner },
              { key: 'banks', label: 'Bankalar', value: (r) => r.banks },
              { key: 'status', label: 'Faz', value: (r) => r.status, badge: true },
              { key: 'owner', label: 'Sorumlu', value: (r) => r.owner },
              {
                key: 'plan',
                label: `Forecast'e ekle`,
                value: () => '',
                render: (r) => (
                  <ForecastQuickAdd customerId={r.id} customerName={r.name} options={quickOptions} defaultYear={year + 1} compact onSaved={reload} />
                ),
              },
            ]}
          />
        </>
      )}

      {tab === 4 && (
        <>
          <ScenarioBar pct={pct} setPct={setPct} weighted={weighted} setWeighted={setWeighted} />
          <MonthlyResult title={`${year} sonuç — gerçekleşen + senaryo`} actual={calc.monthly} forecast={forecastMonthly(oppNow)} refMonth={refMonth} />
        </>
      )}

      {tab === 5 && (
        <>
          <ScenarioBar pct={pctNext} setPct={setPctNext} weighted={weightedNext} setWeighted={setWeightedNext} />
          <MonthlyResult title={`${year + 1} sonuç — senaryo`} actual={MONTHS.map(() => 0)} forecast={forecastMonthly(oppNext)} refMonth={-1} />
        </>
      )}
    </Page>
  );
}
