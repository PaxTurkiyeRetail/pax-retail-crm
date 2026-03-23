'use client';
import '@/styles/weekly-activities.css';

import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';

type Kpis = {
  totalActivities: number;
  activePeople: number;
  distinctCustomers: number;
  phone: number;
  faceToFace: number;
  online: number;
  technicalVisit: number;
  technicalOnline: number;
  salesActivities: number;
  technicalActivities: number;
  topPerformer: string;
  topCustomer: string;
};

type FilterBag = {
  from: string;
  to: string;
  ownerOptions: string[];
  responsibleOptions: string[];
  customerOptions: string[];
  channelOptions: string[];
  phaseOptions: string[];
  waitingOptions: string[];
  statusOptions: string[];
};

type ByPerson = {
  kisi: string;
  total: number;
  phone: number;
  face: number;
  online: number;
  technicalVisit: number;
  technicalOnline: number;
  sales: number;
  technical: number;
  customerCount: number;
  lastActivity: string;
  busiestCustomer: string;
  dailyAverage: number;
};

type ByCustomer = {
  customer: string;
  responsible: string;
  total: number;
  phone: number;
  face: number;
  online: number;
  technicalVisit: number;
  technicalOnline: number;
  lastActivity: string;
  lastOwner: string;
  lastChannel: string;
  phase: string;
  waiting: string;
  notes: string;
};

type ByDay = {
  day: string;
  total: number;
  phone: number;
  face: number;
  online: number;
  technicalVisit: number;
  technicalOnline: number;
  activePeople: number;
  customerCount: number;
};

type DetailRow = {
  id: string;
  created_at: string;
  created_by: string;
  responsible: string;
  customer: string;
  sector: string;
  integration: string;
  phase: string;
  waiting: string;
  status: string;
  channel: string;
  notes: string;
};

type Payload = {
  filters: FilterBag;
  kpis: Kpis;
  byPerson: ByPerson[];
  byCustomer: ByCustomer[];
  byDay: ByDay[];
  list: DetailRow[];
};

const EMPTY: Payload = {
  filters: { from: '', to: '', ownerOptions: [], responsibleOptions: [], customerOptions: [], channelOptions: [], phaseOptions: [], waitingOptions: [], statusOptions: [] },
  kpis: { totalActivities: 0, activePeople: 0, distinctCustomers: 0, phone: 0, faceToFace: 0, online: 0, technicalVisit: 0, technicalOnline: 0, salesActivities: 0, technicalActivities: 0, topPerformer: '-', topCustomer: '-' },
  byPerson: [], byCustomer: [], byDay: [], list: [],
};

type TabKey = 'person' | 'customer' | 'day' | 'detail';

function thisWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    to: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  };
}


export default function WeeklyActivitiesReportPage() {
  const defaults = useMemo(() => thisWeekRange(), []);
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('person');
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [owner, setOwner] = useState('');
  const [responsible, setResponsible] = useState('');
  const [customer, setCustomer] = useState('');
  const [channel, setChannel] = useState('');
  const [phase, setPhase] = useState('');
  const [waiting, setWaiting] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (owner) params.set('owner', owner);
      if (responsible) params.set('responsible', responsible);
      if (customer) params.set('customer', customer);
      if (channel) params.set('channel', channel);
      if (phase) params.set('phase', phase.replace('FAZ ', ''));
      if (waiting) params.set('waiting', waiting);
      if (status) params.set('status', status);
      const res = await fetch(`/api/reports/weekly-activities?${params.toString()}`, { next: { revalidate: 30 } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.message || 'Rapor yüklenemedi.');
        setPayload(EMPTY);
        return;
      }
      setPayload({ ...EMPTY, ...(json ?? {}) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [from, to, owner, responsible, customer, channel, phase, waiting, status]);

  const kpiCards = [
    { label: 'Toplam Aktivite', value: payload.kpis.totalActivities, hint: 'Haftalık toplam' },
    { label: 'Aktif Kişi', value: payload.kpis.activePeople, hint: 'En az 1 kayıt' },
    { label: 'Görüşülen Firma', value: payload.kpis.distinctCustomers, hint: 'Distinct müşteri' },
    { label: 'Telefon', value: payload.kpis.phone, hint: 'Satış kanalı' },
    { label: 'Yüz Yüze', value: payload.kpis.faceToFace, hint: 'Yerinde ziyaret' },
    { label: 'Online', value: payload.kpis.online, hint: 'Online toplantı' },
    { label: 'Teknik Ziyaret', value: payload.kpis.technicalVisit, hint: 'Teknik saha' },
    { label: 'Teknik Online', value: payload.kpis.technicalOnline, hint: 'Teknik uzaktan' },
    { label: 'En Yoğun Kişi', value: payload.kpis.topPerformer, hint: 'Top performer' },
    { label: 'En Yoğun Firma', value: payload.kpis.topCustomer, hint: 'En çok aktivite' },
  ];

  const clearFilters = () => {
    setFrom(defaults.from);
    setTo(defaults.to);
    setOwner('');
    setResponsible('');
    setCustomer('');
    setChannel('');
    setPhase('');
    setWaiting('');
    setStatus('');
  };

  return (
    <main className="pax-page-container">

      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Rapor Merkezi · Aktivite Analizi</span>
        <h1 className="pax-hero-title">Haftalık Aktivite Raporu</h1>
        <p className="pax-hero-description">Kişi bazlı ve ekip bazlı aktivite yoğunluğu, teknik aktivite kırılımı ve firma bazlı temas özeti tek sayfada.</p>
      </div>

      <section className="stats">
        {kpiCards.map((item) => <div key={item.label} className="card"><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><div className="card-hint">{item.hint}</div></div>)}
      </section>

      <section className="surface">
        <div className="filters-grid">
          <label className="field"><span className="field-label">Başlangıç</span><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span className="field-label">Bitiş</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field"><span className="field-label">Aktiviteyi Giren</span><select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Tümü</option>{payload.filters.ownerOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Sorumlu</span><select className="input" value={responsible} onChange={(e) => setResponsible(e.target.value)}><option value="">Tümü</option>{payload.filters.responsibleOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Firma</span><select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}><option value="">Tümü</option>{payload.filters.customerOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Kanal</span><select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">Tümü</option>{payload.filters.channelOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Faz</span><select className="input" value={phase} onChange={(e) => setPhase(e.target.value)}><option value="">Tümü</option>{payload.filters.phaseOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Bekleyen Taraf</span><select className="input" value={waiting} onChange={(e) => setWaiting(e.target.value)}><option value="">Tümü</option>{payload.filters.waitingOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Durum</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tümü</option>{payload.filters.statusOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Görünüm</span><div className="input" style={{ display:'flex', alignItems:'center' }}>Kayıt: <strong style={{ marginLeft: 6 }}>{payload.list.length}</strong></div></label>
        </div>
        <div className="filter-actions"><button className="button" onClick={clearFilters}>Filtreyi Temizle</button></div>
      </section>

      <section className="surface">
        <div className="tabs">
          <button className={`tab ${tab === 'person' ? 'active' : ''}`} onClick={() => setTab('person')}>Kişi Bazlı</button>
          <button className={`tab ${tab === 'customer' ? 'active' : ''}`} onClick={() => setTab('customer')}>Firma Bazlı</button>
          <button className={`tab ${tab === 'day' ? 'active' : ''}`} onClick={() => setTab('day')}>Günlük Kırılım</button>
          <button className={`tab ${tab === 'detail' ? 'active' : ''}`} onClick={() => setTab('detail')}>Detay Liste</button>
        </div>
      </section>

      {msg ? <div className="message">{msg}</div> : null}

      {tab === 'person' ? (
        <section className="surface"><div className="table-wrap"><table><thead><tr>{['Kişi', 'Toplam', 'Telefon', 'Yüz Yüze', 'Online', 'Teknik Ziyaret', 'Teknik Online', 'Firma Sayısı', 'En Yoğun Firma', 'Ort. Günlük', 'Son Aktivite'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{payload.byPerson.map((row) => <tr key={row.kisi}><td style={{fontWeight:800}}>{row.kisi}</td><td>{row.total}</td><td>{row.phone}</td><td>{row.face}</td><td>{row.online}</td><td>{row.technicalVisit}</td><td>{row.technicalOnline}</td><td>{row.customerCount}</td><td>{row.busiestCustomer}</td><td>{row.dailyAverage}</td><td>{formatDate(row.lastActivity)}</td></tr>)}{!loading && !payload.byPerson.length ? <tr><td colSpan={11} style={{padding:16,color:'#64748b'}}>Kayıt yok.</td></tr> : null}</tbody></table></div></section>
      ) : null}

      {tab === 'customer' ? (
        <section className="surface"><div className="table-wrap"><table><thead><tr>{['Firma', 'Sorumlu', 'Toplam', 'Telefon', 'Yüz Yüze', 'Online', 'Teknik Ziyaret', 'Teknik Online', 'Son Aktivite', 'Son Kanal', 'Son Yapan', 'Faz', 'Bekleyen'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{payload.byCustomer.map((row) => <tr key={row.customer}><td style={{fontWeight:800}}>{row.customer}</td><td>{row.responsible}</td><td>{row.total}</td><td>{row.phone}</td><td>{row.face}</td><td>{row.online}</td><td>{row.technicalVisit}</td><td>{row.technicalOnline}</td><td>{formatDate(row.lastActivity)}</td><td><span className="pill">{row.lastChannel}</span></td><td>{row.lastOwner}</td><td>{row.phase}</td><td>{row.waiting}</td></tr>)}{!loading && !payload.byCustomer.length ? <tr><td colSpan={13} style={{padding:16,color:'#64748b'}}>Kayıt yok.</td></tr> : null}</tbody></table></div></section>
      ) : null}

      {tab === 'day' ? (
        <section className="surface"><div className="table-wrap"><table><thead><tr>{['Gün', 'Toplam', 'Telefon', 'Yüz Yüze', 'Online', 'Teknik Ziyaret', 'Teknik Online', 'Aktif Kişi', 'Firma Sayısı'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{payload.byDay.map((row) => <tr key={row.day}><td style={{fontWeight:800}}>{row.day}</td><td>{row.total}</td><td>{row.phone}</td><td>{row.face}</td><td>{row.online}</td><td>{row.technicalVisit}</td><td>{row.technicalOnline}</td><td>{row.activePeople}</td><td>{row.customerCount}</td></tr>)}{!loading && !payload.byDay.length ? <tr><td colSpan={9} style={{padding:16,color:'#64748b'}}>Kayıt yok.</td></tr> : null}</tbody></table></div></section>
      ) : null}

      {tab === 'detail' ? (
        <section className="surface"><div className="table-wrap"><table><thead><tr>{['Tarih', 'Firma', 'Sorumlu', 'Aktiviteyi Giren', 'Kanal', 'Faz', 'Bekleyen', 'Durum', 'Not'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{payload.list.map((row) => <tr key={row.id}><td>{formatDate(row.created_at)}</td><td style={{fontWeight:800}}>{row.customer}</td><td>{row.responsible}</td><td>{row.created_by}</td><td><span className="pill">{row.channel}</span></td><td>{row.phase}</td><td>{row.waiting}</td><td>{row.status}</td><td>{row.notes || '-'}</td></tr>)}{!loading && !payload.list.length ? <tr><td colSpan={9} style={{padding:16,color:'#64748b'}}>Kayıt yok.</td></tr> : null}</tbody></table></div></section>
      ) : null}
    </main>
  );
}
