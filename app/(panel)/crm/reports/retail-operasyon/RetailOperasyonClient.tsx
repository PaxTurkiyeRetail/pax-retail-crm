'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import type { RetailOperasyonPayload, RetailOpportunity } from '@/lib/reports/retail-operasyon';
import { businessLabel, businessType, isTerminal, retailModel } from '@/lib/reports/retail-projection';
import { loadForecastQuickAddOptions, type ForecastQuickAddOptions } from '@/components/forecast/ForecastQuickAdd';
import Table from './RetailTable';
import RetailResults from './RetailResults';
import RetailPlanEditor from './RetailPlanEditor';
import RetailPlanQuickAdd from './RetailPlanQuickAdd';
import s from './retail-operasyon.module.css';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const sum = <T,>(rows: T[], value: (r: T) => number) => rows.reduce((a, r) => a + value(r), 0);
const unique = <T,>(rows: T[], value: (r: T) => string) => new Set(rows.map(value)).size;

function Metrics({ items }: { items: { label: string; value: ReactNode; sub?: string }[] }) {
  return <div className={s.metrics}>{items.map((m) => <div className={s.metric} key={m.label}><div>{m.label}</div><strong>{m.value}</strong>{m.sub && <small>{m.sub}</small>}</div>)}</div>;
}

function Distribution({ title, rows, field }: { title: string; rows: RetailOperasyonPayload['crm']; field: 'kasa' | 'pos' }) {
  const counts = new Map<string, number>();
  rows.forEach((r) => { const key = r[field] || 'Bilinmeyen'; counts.set(key, (counts.get(key) ?? 0) + 1); });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return <section className={s.card}><h3>{title}</h3>{entries.length ? entries.map(([label, count]) => <div className={s.barrow} key={label}><span title={label}>{label}</span><div className={s.track}><span style={{ width: `${count / max * 100}%` }} /></div><b>{nf.format(count)}</b></div>) : <p className={s.empty}>Dağılım verisi yok.</p>}</section>;
}

export default function RetailOperasyonClient() {
  const [data, setData] = useState<RetailOperasyonPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(0);
  const [pct, setPct] = useState(100);
  const [pctNext, setPctNext] = useState(100);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ kasa: '', pos: '', posOwner: '', status: '' });
  const [order, setOrder] = useState('register');
  const [quickOptions, setQuickOptions] = useState<ForecastQuickAddOptions | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [yearChoice, setYearChoice] = useState(new Date().getFullYear());
  const [accountManager, setAccountManager] = useState('');
  const [accountManagers, setAccountManagers] = useState<NonNullable<RetailOperasyonPayload['accountManagers']>>([]);
  const [editingPlan,setEditingPlan]=useState<{row:RetailOpportunity;year:number}|null>(null);
  const activeRequest=useRef<AbortController|null>(null);
  const requestVersion=useRef(0);
  const requestBusy=useRef(false);

  const reload = useCallback(async ({background=false}:{background?:boolean}={}) => {
    if(background&&requestBusy.current)return;
    const version=++requestVersion.current;
    activeRequest.current?.abort();
    const controller=new AbortController();activeRequest.current=controller;requestBusy.current=true;
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ year: String(yearChoice), accountManager });
      const r = await fetch(`/api/reports/retail-operasyon?${params}`, { cache: 'no-store',signal:controller.signal });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message||j?.message || 'Veri alınamadı');
      if(version===requestVersion.current&&!controller.signal.aborted){setData(j);setAccountManagers(j.accountManagers ?? []);}
    } catch (e) { if(version===requestVersion.current&&!controller.signal.aborted)setError(e instanceof Error ? e.message : 'Veri alınamadı'); }
    finally { if(version===requestVersion.current&&!controller.signal.aborted){requestBusy.current=false;setBusy(false);} }
  }, [yearChoice, accountManager]);
  useEffect(() => { void reload();const controller=activeRequest.current;return()=>controller?.abort(); }, [reload]);
  useEffect(() => {
    if ((tab === 3||editingPlan) && data?.canEditForecast && !quickOptions) loadForecastQuickAddOptions().then(setQuickOptions).catch((e) => setError(e.message));
  }, [tab, quickOptions,data?.canEditForecast,editingPlan]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='hidden'||editingPlan||(tab===3&&planning)||requestBusy.current)return;void reload({background:true});};
    const timer=window.setInterval(refresh,60_000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[reload,editingPlan,planning,tab]);
  useEffect(() => {
    if (!planning) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPlanning(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [planning]);

  const year = data?.year ?? yearChoice;
  const planNow = useMemo(() => (data?.opportunities.current ?? []).filter((o) => o.includeInRetailPlan !== false), [data]);
  const planNext = useMemo(() => (data?.opportunities.next ?? []).filter((o) => o.includeInRetailPlan !== false), [data]);
  const sales = data?.sales ?? [];
  const actualQty = sum(sales.filter((r) => isTerminal(r.model)), (r) => r.qty);
  const actualUsd = sum(sales.filter((r) => r.saleType !== 'rental'), (r) => r.usd);
  const firms = [...new Set(sales.map((r) => r.firm))].map((firm) => {
    const rows = sales.filter((r) => r.firm === firm);
    return { firm, models: [...new Set(rows.map((r) => r.model))].join(', '), qty: sum(rows.filter((r) => isTerminal(r.model)), (r) => r.qty), usd: sum(rows.filter((r) => r.saleType !== 'rental'), (r) => r.usd) };
  }).sort((a, b) => b.usd - a.usd);

  const crm = useMemo(() => data?.crm ?? [], [data]);
  const crmRows = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr-TR');
    return crm.filter((r) => (!term || [r.name, r.sector, r.kasa, r.owner, r.status, r.pos, r.banks].join(' ').toLocaleLowerCase('tr-TR').includes(term)) && Object.entries(filters).every(([k, v]) => !v || r[k as keyof typeof filters] === v))
      .sort((a, b) => order === 'register' ? (b.register ?? -1) - (a.register ?? -1) || a.name.localeCompare(b.name, 'tr') : (order === 'pos' ? a.pos.localeCompare(b.pos, 'tr') : a.name.localeCompare(b.name, 'tr')));
  }, [crm, q, filters, order]);
  const planned = new Set(planNext.map((r) => r.customerId).filter(Boolean));

  async function updateMonth(row: RetailOpportunity, month: number) {
    if (!row.id || !row.canEdit || row.source!=='forecast') return;
    setSavingId(row.id); setError('');
    try {
      const r = await fetch('/api/forecast/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id, product_id: row.productId || row.model, quantity: row.qty, forecast_year: year + 1, forecast_month: month, sales_channel: row.channel, probability: row.prob, note: row.note,expected_updated_at:row.updatedAt }) });
      const j = await r.json();
      if (!r.ok) throw new Error(r.status===409?'Bu plan başka bir kullanıcı tarafından değiştirildi. Raporu yenileyip tekrar deneyin.':j?.error?.message||j?.message||'Plan ayı kaydedilemedi');
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Plan ayı kaydedilemedi'); }
    finally { setSavingId(null); }
  }

  function opportunities(rows: RetailOpportunity[], next: boolean) {
    const models = [...new Set(rows.map((r) => retailModel(r.model)))].map((model) => ({ model, qty: sum(rows.filter((r) => retailModel(r.model) === model), (r) => r.qty) })).sort((a, b) => b.qty - a.qty);
    return <>
      <Metrics items={[
        { label: 'Fırsat firması', value: nf.format(unique(rows, (r) => r.customerId || r.firm)) },
        { label: 'Toplam cihaz', value: nf.format(sum(rows.filter((r) => isTerminal(r.model)), (r) => r.qty)) },
        { label: 'Kiralama cihaz', value: nf.format(sum(rows.filter((r) => isTerminal(r.model) && businessType(r)==='rental'), (r) => r.qty)) },
        { label: 'Satış cihaz', value: nf.format(sum(rows.filter((r) => isTerminal(r.model) && businessType(r)==='sale'), (r) => r.qty)) },
        { label: 'Banka cihaz', value: nf.format(sum(rows.filter((r) => isTerminal(r.model) && businessType(r)==='bank'), (r) => r.qty)),sub:'Toplamda dahil · satış ve kiralamadan ayrı' },
      ]} />
      <Table title="Model dağılımı" rows={models} columns={[{ key: 'model', label: 'Model', value: (r) => r.model }, { key: 'qty', label: 'Adet', value: (r) => r.qty, num: true }]} name={`retail-model-${next ? year + 1 : year}`} />
      <Table title={`${next ? year + 1 : year} firma fırsatları`} rows={rows} name={`retail-firsat-${next ? year + 1 : year}`} columns={[
        { key: 'firm', label: 'Firma', value: (r) => r.firm }, { key: 'model', label: 'Model', value: (r) => r.model }, { key: 'qty', label: 'Adet', value: (r) => r.qty, num: true },
        { key: 'mode', label: 'İş modeli', value: businessLabel, render: (r) => <span className={s.pill}>{businessLabel(r)}</span> },
        { key:'source',label:'Kaynak',value:()=> 'Forecast · canlı' },
        { key: 'channel', label: 'Kanal', value: (r) => r.channel }, { key: 'prob', label: 'Olasılık %', value: (r) => r.prob, num: true }, { key: 'note', label: 'Not', value: (r) => r.note }, { key: 'owner', label: 'Account', value: (r) => r.owner },
        { key: 'month', label: 'Planlanan ay', value: (r) => r.month, filterValue: (r) => MONTHS[r.month - 1] ?? '', render: (r) => next && r.id && r.canEdit&&r.source==='forecast' ? <select aria-label={`${r.firm} planlanan ay`} disabled={savingId === r.id} value={r.month} onChange={(e) => void updateMonth(r, Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select> : MONTHS[r.month - 1] ?? '—' },
        {key:'edit',label:'Fırsat işlemi',value:()=>'',searchable:false,sortable:false,render:(r:RetailOpportunity)=>r.canEdit&&r.source==='forecast'&&r.id?<button type="button" className={s.button} onClick={()=>setEditingPlan({row:r,year:next?year+1:year})}>Forecast düzenle</button>:null},
      ]} />
      {next && <p className={s.note}>Banka: {nf.format(sum(rows.filter((r) => businessType(r)==='bank' && isTerminal(r.model)), (r) => r.qty))} cihaz. Banka planları toplam adede dahildir; satış cirosu ve aylık kiralama geliri hesabından ayrı tutulur. Planlanan ay, satırın kendi planına kaydedilir.</p>}
    </>;
  }

  const tabs = ['1. Mevcut Durum', `2. ${year} Yıl Sonu`, `3. ${year + 1} Projeksiyon`, '4. CRM Havuzu', `5. ${year} Aylık Sonuç`, `6. ${year + 1} Aylık Sonuç`];
  const subtitles = ['Gerçekleşen satışlar, KasaPOS entegrasyonu ve kiralama operasyonu.', 'Yıl sonuna kadar beklenen satış ve kiralama fırsatları.', 'Gelecek yılın firma, model ve ay bazında planı.', 'Müşteri havuzunu incele, canlı Forecast fırsatlarını oluştur.', 'Gerçekleşen sonuçlar ve yıl sonu senaryosu, model ve ay bazında.', 'CRM planları ve projeksiyonun birleşik aylık görünümü.'];

  return <div className={s.root}>
    <header className={s.top}><div><span className={s.eyebrow}>PAX TÜRKİYE · RETAIL</span><h1>Gerçekleşen / Bütçe</h1><p>Gerçekleşen sonuçlar ve bütçe planları tek yerde.</p></div><div className={s.actions}><span className={s.live}><i />Canlı CRM verisi</span><label>Account Manager <select aria-label="Account Manager" value={accountManager} disabled={busy} onChange={(e) => { requestVersion.current++;activeRequest.current?.abort();requestBusy.current=false;setPlanning(null);setEditingPlan(null);setData(null);setQ('');setFilters({ kasa: '', pos: '', posOwner: '', status: '' });setAccountManager(e.target.value); }}><option value="">Tüm Account Managerlar</option>{accountManager && !accountManagers.some(manager => manager.value === accountManager) && <option value={accountManager}>Seçili Account Manager (müşteri yok)</option>}{accountManagers.map(manager => <option key={manager.value} value={manager.value}>{manager.label}</option>)}</select></label><label>Rapor yılı <select aria-label="Rapor yılı" value={yearChoice} disabled={busy} onChange={(e) => { requestVersion.current++;activeRequest.current?.abort();requestBusy.current=false;setPlanning(null);setEditingPlan(null);setData(null); setYearChoice(Number(e.target.value)); }}>{Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => <option key={y}>{y}</option>)}</select></label><button className={s.button} disabled={busy} onClick={() => void reload()}><RefreshCw size={14} />{busy ? 'Yenileniyor…' : 'Yenile'}</button></div></header>
    <nav className={s.nav} aria-label="Retail raporları">{tabs.map((label, i) => <button key={i} aria-current={tab === i ? 'page' : undefined} className={tab === i ? s.active : ''} onClick={() => setTab(i)}>{label}</button>)}</nav>
    <div className={s.sectionHeading}><div><h2>{tabs[tab].replace(/^\d\. /, '')}</h2><p>{subtitles[tab]}</p><p>Account Manager: <strong>{accountManager ? accountManagers.find(manager => manager.value === accountManager)?.label ?? 'Seçili Account Manager (müşteri yok)' : 'Tümü'}</strong> · Altı sekmenin tamamına uygulanır · Güncel müşteri sorumlusu esas alınır.</p></div>{data && <span className={s.timestamp}>Son güncelleme {new Date(data.generatedAt).toLocaleString('tr-TR')}</span>}</div>
    {error && <div className={s.error} role="alert">{error}<button className={s.button} onClick={() => void reload()}>Tekrar dene</button></div>}
    {!data && <div className={s.empty} role="status">{busy ? 'Canlı veriler hazırlanıyor…' : 'Rapor verisi yüklenemedi.'}</div>}
    {data && <>
      {tab === 0 && <>
        <Metrics items={[
          { label: `${year} terminal satışı`, value: nf.format(actualQty), sub: 'S210 hariç' }, { label: `${year} satış cirosu`, value: usd.format(actualUsd), sub: 'S210 dahil · USD kayıtlar' },
          { label: 'KasaPOS aktif kasa', value: nf.format(data.kasapos.aktifKasa) }, { label: 'Faturalanan kasa', value: nf.format(data.kasapos.faturalanan), sub: data.kasapos.refMonth ?? 'Fatura dönemi yok' },
          { label: 'KasaPOS firma', value: nf.format(data.kasapos.rows.length) }, { label: 'Aylık hizmet geliri', value: usd.format(data.kasapos.aylikGelir) },
          { label: 'Ek kasa fırsatı', value: nf.format(data.kasapos.firsat) }, { label: 'Ek aylık gelir fırsatı', value: usd.format(data.kasapos.potansiyel) },
        ]} />
        <section className={s.card}><h3>Kiralama operasyonu</h3><Metrics items={[
          { label: 'Aktif kiralık cihaz', value: nf.format(data.rental?.activeQty ?? 0) }, { label: 'Aylık kira geliri', value: usd.format(data.rental?.monthlyRevenue ?? 0) },
          { label: 'Ortalama aylık bedel', value: data.rental?.avgMonthlyPrice != null ? usd.format(data.rental.avgMonthlyPrice) : '—' }, { label: 'Sözleşme', value: nf.format(data.rental?.contracts.length ?? 0) },
        ]} />{data.rental?.byStatus.filter((r) => r.contracts > 0).map((r) => <span key={r.status} className={s.pill}>{r.label}: {nf.format(r.qty)} cihaz</span>)}</section>
        <div className={s.two}>
          <Table title={`${year} firma bazlı satışlar`} rows={firms} name={`retail-satislar-${year}`} columns={[{ key: 'firm', label: 'Firma', value: (r) => r.firm }, { key: 'models', label: 'Modeller', value: (r) => r.models }, { key: 'qty', label: 'Terminal', value: (r) => r.qty, num: true }, { key: 'usd', label: 'USD ciro', value: (r) => r.usd, render: (r) => usd.format(r.usd), num: true }]} />
          <Table title="KasaPOS faturalama" rows={[...data.kasapos.rows].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))} name={`retail-kasapos-${year}`} columns={[{ key: 'firm', label: 'Firma', value: (r) => r.firm }, { key: 'active', label: 'Aktif kasa', value: (r) => r.active, num: true }, { key: 'billed', label: 'Faturalanan', value: (r) => r.billed, num: true }, { key: 'gap', label: 'Fırsat', value: (r) => r.gap, num: true }, { key: 'rate', label: 'Kullanım %', value: (r) => r.rate, num: true }]} />
        </div>
        <Table title="Kiralama sözleşmeleri" rows={data.rental?.contracts ?? []} name={`retail-kiralama-${year}`} columns={[{ key: 'firm', label: 'Firma', value: (r) => r.firm }, { key: 'status', label: 'Durum', value: (r) => r.statusLabel }, { key: 'qty', label: 'Adet', value: (r) => r.qty, num: true }, { key: 'monthly', label: 'Aylık kira (USD)', value: (r) => r.monthly, render: (r) => usd.format(r.monthly), num: true }, { key: 'start', label: 'Başlangıç', value: (r) => r.start?.slice(0, 10) ?? '' }, { key: 'end', label: 'Bitiş', value: (r) => r.end?.slice(0, 10) ?? '' }, { key: 'note', label: 'Not', value: (r) => r.note }]} />
      </>}
      {tab === 1 && opportunities(planNow, false)}
      {tab === 2 && opportunities(planNext, true)}
      {tab === 3 && <>
        <Metrics items={[
          { label: 'CRM firması', value: nf.format(crm.length) }, { label: 'POS markası bilinen', value: nf.format(crm.filter((r) => r.pos && !/bilinmeyen/i.test(r.pos)).length) },
          { label: 'Kasa firması bilinen', value: nf.format(crm.filter((r) => r.kasa && !/bilinmeyen/i.test(r.kasa)).length) }, { label: 'Planlanan firma', value: nf.format(planned.size), sub: `${nf.format(sum(planNext, (r) => r.qty))} cihaz · ${year + 1}` },
        ]} />
        <div className={s.two}><Distribution title="Kasa firması dağılımı" rows={crm} field="kasa" /><Distribution title="POS markası dağılımı" rows={crm} field="pos" /></div>
        <div className={s.banner}><strong>{year + 1} firma planını buradan oluştur</strong><p>Firma satırındaki “Plan ekle” ile model, adet ve ay seç. Kaydettiğin plan Forecast ve aylık sonuçlara yansır.</p></div>
        <div className={s.actions}><input aria-label="CRM havuzunda ara" placeholder="Firma, sektör, kasa, POS veya Account ara…" value={q} onChange={(e) => setQ(e.target.value)} />
          {(['kasa', 'pos', 'posOwner', 'status'] as const).map((key) => <select key={key} aria-label={{ kasa: 'Kasa firması', pos: 'POS markası', posOwner: 'POS sahipliği', status: 'CRM statüsü' }[key]} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}><option value="">{{ kasa: 'Tüm kasa firmaları', pos: 'Tüm POS markaları', posOwner: 'Tüm sahiplikler', status: 'Tüm statüler' }[key]}</option>{[...new Set(crm.map((r) => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')).map((v) => <option key={v}>{v}</option>)}</select>)}
          <select aria-label="Firma sırası" value={order} onChange={(e) => setOrder(e.target.value)}><option value="register">Kasa adedine göre</option><option value="name">Firma adına göre</option><option value="pos">POS markasına göre</option></select>
          {(q || Object.values(filters).some(Boolean)) && <button className={s.button} onClick={() => { setQ(''); setFilters({ kasa: '', pos: '', posOwner: '', status: '' }); }}>Filtreleri temizle</button>}
          <span>{nf.format(crmRows.length)} / {nf.format(crm.length)} firma</span>
        </div>
        <Table title="CRM müşteri ve plan havuzu" rows={crmRows} name={`retail-crm-plan-${year + 1}`} detail={(r) => r.canPlan && planning === r.id && <div><div className={s.cardHeader}><strong>{r.name} · {year + 1} yeni plan</strong><button className={s.button} onClick={() => setPlanning(null)}>Vazgeç</button></div><RetailPlanQuickAdd customerId={r.id} customerName={r.name} options={quickOptions} year={year + 1} onSaved={reload} /></div>} columns={[
          { key: 'name', label: 'Firma', value: (r) => r.name },
          {key:'forecastState',label:'Forecast kayıtları',value:r=>r.hasForecast?`Mevcut · ${(r.forecastYears??[]).join(', ')}`:'Henüz yok'},
          { key: 'planModel', label: 'Planlanan model', value: (r) => planNext.filter((p) => p.customerId === r.id).map((p) => p.model).join(', ') || '—' },
          { key: 'planQty', label: 'Planlanan adet', value: (r) => sum(planNext.filter((p) => p.customerId === r.id), (p) => p.qty), num: true },
          { key: 'planMonth', label: 'Planlanan ay', value: (r) => [...new Set(planNext.filter((p) => p.customerId === r.id).map((p) => MONTHS[p.month - 1]))].join(', ') || '—' },
          { key: 'plan', label: 'Plan işlemi', value: () => '', searchable:false,sortable:false, render: (r) => r.canPlan ? <button className={s.button} aria-expanded={planning === r.id} onClick={() => setPlanning(planning === r.id ? null : r.id)}>{planning === r.id ? 'Planı kapat' : 'Plan ekle'}</button> : '—' },
          { key: 'kasa', label: 'Kasa firması', value: (r) => r.kasa }, { key: 'register', label: 'Kasa sayısı', value: (r) => r.register, num: true }, { key: 'pos', label: 'POS markası', value: (r) => r.pos }, { key: 'posOwner', label: 'POS sahipliği', value: (r) => r.posOwner }, { key: 'status', label: 'CRM statüsü', value: (r) => r.status }, { key: 'owner', label: 'Account', value: (r) => r.owner }, { key: 'banks', label: 'Bankalar', value: (r) => r.banks },
        ]} />
      </>}
      {(tab === 4 || tab === 5) && <>
        <div className={s.scenario}><div><strong>Gerçekleşme senaryosu</strong><span>Gerçekleşen satışlar değişmez. Olasılık yüzdesi ayrıca uygulanmaz.</span></div><label><input aria-label="Senaryo gerçekleşme oranı" type="range" min="0" max="100" step="1" value={tab === 4 ? pct : pctNext} onChange={(e) => (tab === 4 ? setPct : setPctNext)(Number(e.target.value))} /><input aria-label="Senaryo yüzdesi" type="number" min="0" max="100" value={tab === 4 ? pct : pctNext} onChange={(e) => (tab === 4 ? setPct : setPctNext)(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />%<button className={s.button} onClick={() => (tab === 4 ? setPct : setPctNext)(100)}>Sıfırla</button></label></div>
        <RetailResults data={data} year={tab === 4 ? year : year + 1} pct={tab === 4 ? pct : pctNext} />
      </>}
    </>}
    <footer className={s.foot}>Kaynak: CRM satışları, Forecast, KasaPOS faturaları ve Retail müşteri havuzu. S210 aksesuarı terminal sayısına girmez; ürün cirosuna dahildir.</footer>
    {editingPlan&&editingPlan.row.canEdit&&<RetailPlanEditor row={editingPlan.row} year={editingPlan.year} options={quickOptions} onClose={()=>setEditingPlan(null)} onSaved={reload}/>}
  </div>;
}
