'use client';
import '@/styles/weekly-activities.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/utils';

type Kpis = {
  totalActivities: number; activePeople: number; distinctCustomers: number;
  phone: number; faceToFace: number; online: number;
  technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number;
  salesActivities: number; technicalActivities: number;
  topPerformer: string; topCustomer: string;
};

type FilterBag = {
  from: string; to: string;
  ownerOptions: string[]; responsibleOptions: string[]; customerOptions: string[];
  channelOptions: string[]; phaseOptions: string[]; waitingOptions: string[]; statusOptions: string[];
};

type ByPerson = {
  kisi: string; total: number; phone: number; face: number; online: number;
  technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number; sales: number; technical: number;
  customerCount: number; lastActivity: string; busiestCustomer: string; dailyAverage: number;
};

type ByCustomer = {
  customer: string; responsible: string; total: number;
  phone: number; face: number; online: number; technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number;
  lastActivity: string; lastOwner: string; lastChannel: string; phase: string; waiting: string; notes: string;
};

type ByDay = {
  day: string; total: number; phone: number; face: number; online: number;
  technicalVisit: number; technicalOnline: number; pom: number; email: number; other: number; activePeople: number; customerCount: number;
};

type DetailRow = {
  id: string; created_at: string; created_by: string; responsible: string;
  customer: string; sector: string; integration: string;
  phase: string; waiting: string; status: string; channel: string; notes: string;
};

type Payload = {
  filters: FilterBag; kpis: Kpis;
  byPerson: ByPerson[]; byCustomer: ByCustomer[]; byDay: ByDay[]; list: DetailRow[];
};

const EMPTY: Payload = {
  filters: { from: '', to: '', ownerOptions: [], responsibleOptions: [], customerOptions: [], channelOptions: [], phaseOptions: [], waitingOptions: [], statusOptions: [] },
  kpis: { totalActivities: 0, activePeople: 0, distinctCustomers: 0, phone: 0, faceToFace: 0, online: 0, technicalVisit: 0, technicalOnline: 0, pom: 0, email: 0, other: 0, salesActivities: 0, technicalActivities: 0, topPerformer: '-', topCustomer: '-' },
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
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(end) };
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

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (owner) params.set('owner', owner);
      if (responsible) params.set('responsible', responsible);
      if (customer) params.set('customer', customer);
      if (channel) params.set('channel', channel);
      if (phase) params.set('phase', phase.replace('FAZ ', ''));
      if (waiting) params.set('waiting', waiting);
      if (status) params.set('status', status);
      const res = await fetch(`/api/reports/weekly-activities?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(json?.message || 'Rapor yüklenemedi.'); setPayload(EMPTY); return; }
      setPayload({ ...EMPTY, ...(json ?? {}) });
    } finally { setLoading(false); }
  }, [from, to, owner, responsible, customer, channel, phase, waiting, status]);

  useEffect(() => { void load(); }, [load]);

  const clearFilters = () => {
    setFrom(defaults.from); setTo(defaults.to);
    setOwner(''); setResponsible(''); setCustomer('');
    setChannel(''); setPhase(''); setWaiting(''); setStatus('');
  };

  const kpiCards = [
    { label: 'Toplam Aktivite',  value: payload.kpis.totalActivities,   hint: 'Haftalık toplam' },
    { label: 'Aktif Kişi',       value: payload.kpis.activePeople,       hint: 'En az 1 kayıt' },
    { label: 'Görüşülen Firma',  value: payload.kpis.distinctCustomers,  hint: 'Unique müşteri' },
    { label: 'Telefon',          value: payload.kpis.phone,              hint: 'Satış kanalı' },
    { label: 'Yüz Yüze',        value: payload.kpis.faceToFace,         hint: 'Yerinde ziyaret' },
    { label: 'Online',           value: payload.kpis.online,             hint: 'Online toplantı' },
    { label: 'Teknik Ziyaret',   value: payload.kpis.technicalVisit,     hint: 'Teknik saha' },
    { label: 'Teknik Online',    value: payload.kpis.technicalOnline,    hint: 'Teknik uzaktan' },
    { label: 'POM',              value: payload.kpis.pom ?? 0,             hint: 'POM' },
    { label: 'En Yoğun Kişi',   value: payload.kpis.topPerformer,       hint: 'Top performer' },
    { label: 'En Yoğun Firma',  value: payload.kpis.topCustomer,        hint: 'En çok aktivite' },
  ];

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'person',   label: 'Kişi Bazlı' },
    { key: 'customer', label: 'Firma Bazlı' },
    { key: 'day',      label: 'Günlük Kırılım' },
    { key: 'detail',   label: 'Detay Liste' },
  ];

  return (
    <main className="pax-page-container wa-page">

      {/* Hero */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Rapor Merkezi · Aktivite Analizi</span>
        <h1 className="pax-hero-title">Haftalık Aktivite Raporu</h1>
        <p className="pax-hero-description">
          Kişi bazlı ve ekip bazlı aktivite yoğunluğu, teknik aktivite kırılımı ve firma bazlı temas özeti tek sayfada.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="wa-kpi-grid">
        {kpiCards.map((item) => (
          <div key={item.label} className="wa-kpi-card">
            <div className="wa-kpi-label">{item.label}</div>
            <div className="wa-kpi-value">{item.value}</div>
            <div className="wa-kpi-hint">{item.hint}</div>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className="wa-filter-panel">
        <div className="wa-filter-grid">
          <div className="wa-field">
            <span className="wa-field-label">Başlangıç</span>
            <input className="wa-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Bitiş</span>
            <input className="wa-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Aktiviteyi Giren</span>
            <select className="wa-input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.ownerOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Sorumlu</span>
            <select className="wa-input" value={responsible} onChange={(e) => setResponsible(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.responsibleOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Firma</span>
            <select className="wa-input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.customerOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Kanal</span>
            <select className="wa-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.channelOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Faz</span>
            <select className="wa-input" value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.phaseOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Bekleyen Taraf</span>
            <select className="wa-input" value={waiting} onChange={(e) => setWaiting(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.waitingOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="wa-field">
            <span className="wa-field-label">Durum</span>
            <select className="wa-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tümü</option>
              {payload.filters.statusOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="wa-filter-footer">
          <span className="wa-record-count">
            {loading ? 'Yükleniyor…' : <><strong>{payload.list.length}</strong> kayıt</>}
          </span>
          <button className="wa-btn-clear" onClick={clearFilters}>Filtreyi Temizle</button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="wa-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`wa-tab ${tab === t.key ? 'wa-tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="wa-message">{msg}</div>}

     
      {/* Kişi Bazlı */}
      {tab === 'person' && (
        <div className="wa-table-panel">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  {['Kişi', 'Toplam', 'Telefon', 'Yüz Yüze', 'Online', 'Teknik Ziyaret', 'Teknik Online', 'POM', 'E-posta', 'Diğer', 'Firma Sayısı', 'En Yoğun Firma', 'Ort. Günlük', 'Son Aktivite'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.byPerson.map((row) => (
                  <tr key={row.kisi}>
                    <td className="wa-bold">{row.kisi}</td>
                    <td>{row.total}</td>
                    <td>{row.phone}</td>
                    <td>{row.face}</td>
                    <td>{row.online}</td>
                    <td>{row.technicalVisit}</td>
                    <td>{row.technicalOnline}</td>
                    <td>{row.pom ?? 0}</td>
                    <td>{row.email}</td>
                    <td>{row.other}</td>
                    <td>{row.customerCount}</td>
                    <td>{row.busiestCustomer}</td>
                    <td>{row.dailyAverage}</td>
                    <td className="wa-muted">{formatDate(row.lastActivity)}</td>
                  </tr>
                ))}
                {!loading && !payload.byPerson.length && (
                  <tr><td colSpan={14} className="wa-empty-td">Bu dönemde kayıt yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Firma Bazlı */}
      {tab === 'customer' && (
        <div className="wa-table-panel">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  {['Firma', 'Sorumlu', 'Toplam', 'Telefon', 'Yüz Yüze', 'Online', 'Teknik Ziyaret', 'Teknik Online', 'POM', 'E-posta', 'Diğer', 'Son Aktivite', 'Son Kanal', 'Son Yapan', 'Faz', 'Bekleyen'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.byCustomer.map((row) => (
                  <tr key={row.customer}>
                    <td className="wa-bold">{row.customer}</td>
                    <td>{row.responsible}</td>
                    <td>{row.total}</td>
                    <td>{row.phone}</td>
                    <td>{row.face}</td>
                    <td>{row.online}</td>
                    <td>{row.technicalVisit}</td>
                    <td>{row.technicalOnline}</td>
                    <td>{row.pom ?? 0}</td>
                    <td>{row.email}</td>
                    <td>{row.other}</td>
                    <td className="wa-muted">{formatDate(row.lastActivity)}</td>
                    <td><span className="wa-pill">{row.lastChannel}</span></td>
                    <td>{row.lastOwner}</td>
                    <td>{row.phase}</td>
                    <td>{row.waiting}</td>
                  </tr>
                ))}
                {!loading && !payload.byCustomer.length && (
                  <tr><td colSpan={16} className="wa-empty-td">Bu dönemde kayıt yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Günlük Kırılım */}
      {tab === 'day' && (
        <div className="wa-table-panel">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  {['Gün', 'Toplam', 'Telefon', 'Yüz Yüze', 'Online', 'Teknik Ziyaret', 'Teknik Online', 'POM', 'E-posta', 'Diğer', 'Aktif Kişi', 'Firma Sayısı'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.byDay.map((row) => (
                  <tr key={row.day}>
                    <td className="wa-bold">{row.day}</td>
                    <td>{row.total}</td>
                    <td>{row.phone}</td>
                    <td>{row.face}</td>
                    <td>{row.online}</td>
                    <td>{row.technicalVisit}</td>
                    <td>{row.technicalOnline}</td>
                    <td>{row.pom ?? 0}</td>
                    <td>{row.email}</td>
                    <td>{row.other}</td>
                    <td>{row.activePeople}</td>
                    <td>{row.customerCount}</td>
                  </tr>
                ))}
                {!loading && !payload.byDay.length && (
                  <tr><td colSpan={12} className="wa-empty-td">Bu dönemde kayıt yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detay Liste */}
      {tab === 'detail' && (
        <div className="wa-table-panel">
          <div className="wa-table-wrap">
            <table className="wa-table">
              <thead>
                <tr>
                  {['Tarih', 'Firma', 'Sorumlu', 'Aktiviteyi Giren', 'Kanal', 'Faz', 'Bekleyen', 'Durum', 'Not'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.list.map((row) => (
                  <tr key={row.id}>
                    <td className="wa-muted">{formatDate(row.created_at)}</td>
                    <td className="wa-bold">{row.customer}</td>
                    <td>{row.responsible}</td>
                    <td>{row.created_by}</td>
                    <td><span className="wa-pill">{row.channel}</span></td>
                    <td>{row.phase}</td>
                    <td>{row.waiting}</td>
                    <td>{row.status}</td>
                    <td className="wa-muted">{row.notes || '—'}</td>
                  </tr>
                ))}
                {!loading && !payload.list.length && (
                  <tr><td colSpan={11} className="wa-empty-td">Bu dönemde kayıt yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
