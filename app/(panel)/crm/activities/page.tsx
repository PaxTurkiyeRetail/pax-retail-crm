'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSlaPresentation, getSlaState } from '@/lib/sla';

type ActivityRow = {
  id: string;
  faz_no: number | null;
  activity_label: string | null;
  activity_status?: string | null;
  owner: string | null;
  created_by?: string | null;
  partner_owner?: string | null;
  created_at: string;
  due_date: string | null;
  musteriler: { musteri: string; sorumlu: string | null } | null;
  sla_presentation?: ReturnType<typeof getSlaPresentation>;
};

type FilterOptions = {
  phaseOptions: string[];
  statusOptions: string[];
  partnerOptions: string[];
  ownerOptions: string[];
  responsibleOptions: string[];
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const SLA_OPTIONS = ['', 'overdue', 'today', 'upcoming', 'waiting', 'completed', 'unscheduled'];
const SLA_LABELS: Record<string, string> = { overdue: 'Geciken', today: 'Bugün', upcoming: 'Planlı', waiting: 'Bekleniyor', completed: 'Tamamlanan', unscheduled: 'Tarihsiz' };
const EMPTY_OPTIONS: FilterOptions = { phaseOptions: [], statusOptions: [], partnerOptions: [], ownerOptions: [], responsibleOptions: [] };

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR');
}

export default function ActivitiesPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverToday, setServerToday] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [partnerOwner, setPartnerOwner] = useState('');
  const [fazNo, setFazNo] = useState('');
  const [sla, setSla] = useState('');
  const [owner, setOwner] = useState('');
  const [responsible, setResponsible] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 240);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => { setPage(1); }, [debouncedQ, status, partnerOwner, fazNo, sla, owner, responsible, fromDate, toDate, pageSize]);

  useEffect(() => {
    const loadOptions = async () => {
      const res = await fetch('/api/activities/options', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) setOptions({ ...EMPTY_OPTIONS, ...(payload ?? {}) });
    };
    void loadOptions();
  }, []);

  useEffect(() => {
    const load = async () => {
      setMsg(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (debouncedQ) params.set('q', debouncedQ);
        if (status) params.set('durum', status);
        if (partnerOwner) params.set('partner_owner', partnerOwner);
        if (fazNo) params.set('faz_no', fazNo);
        if (sla) params.set('sla', sla);
        if (owner) params.set('owner', owner);
        if (responsible) params.set('responsible', responsible);
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        const res = await fetch(`/api/activities/list?${params.toString()}`, { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg(payload?.message || 'Liste alınamadı');
          setRows([]);
          setTotal(0);
          return;
        }
        setRows(payload.rows ?? []);
        setTotal(Number(payload.total ?? 0));
        setServerToday(typeof payload.serverToday === 'string' ? payload.serverToday : null);
      } finally { setLoading(false); }
    };
    void load();
  }, [debouncedQ, page, pageSize, status, partnerOwner, fazNo, sla, owner, responsible, fromDate, toDate]);

  const slimRows = useMemo(() => rows.map((row) => ({ ...row, sla: row.sla_presentation ?? getSlaPresentation(row.due_date, row.activity_status, serverToday) })), [rows, serverToday]);
  const stats = useMemo(() => ([
    { label: 'Görünen Aktivite', value: rows.length },
    { label: 'Toplam Sonuç', value: total },
    { label: 'Tamamlanan', value: rows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'completed').length },
    { label: 'Geciken', value: rows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'overdue').length },
    { label: 'Bugün', value: rows.filter((row) => getSlaState(row.due_date, row.activity_status, serverToday) === 'today').length },
  ]), [rows, total, serverToday]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const clearFilters = () => {
    setQ('');
    setStatus('');
    setPartnerOwner('');
    setFazNo('');
    setSla('');
    setOwner('');
    setResponsible('');
    setFromDate('');
    setToDate('');
    setPageSize(20);
  };

  return (
    <main className="page">
      <style jsx>{`
        .page { display: grid; gap: 16px; }
        .hero, .surface, .card { border: 1px solid #d7e3ef; background: rgba(255,255,255,.97); border-radius: 24px; box-shadow: 0 18px 40px rgba(8,28,66,.06); }
        .hero, .surface { padding: 18px; }
        .hero { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 16px; align-items: end; }
        .eyebrow { display: inline-flex; min-height: 32px; align-items: center; padding: 0 12px; border-radius: 999px; background: rgba(9,51,122,.08); color: #09337a; border: 1px solid rgba(9,51,122,.15); font-size: 12px; font-weight: 900; }
        .title { margin: 12px 0 0; font-size: clamp(28px, 3vw, 40px); letter-spacing: -.05em; }
        .sub { color: #5b6b80; font-size: 14px; margin-top: 8px; max-width: 68ch; }
        .primary, .secondary, .ghost { min-height: 42px; border-radius: 14px; padding: 0 14px; font-weight: 800; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
        .primary { border: 1px solid #06285d; background: linear-gradient(135deg,#06285d 0%,#0a4fa3 100%); color: #fff; }
        .secondary, .ghost { border: 1px solid #d5dee8; background: #fff; color: #0f172a; }
        .filters-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .input, .select { min-height: 42px; border-radius: 14px; border: 1px solid #d5dee8; padding: 0 13px; background: #fff; width: 100%; }
        .field { display: grid; gap: 6px; }
        .field-label { font-size: 11px; font-weight: 900; color: #5b6b80; text-transform: uppercase; letter-spacing: .04em; }
        .filter-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: 10px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .card { padding: 14px 15px; }
        .card-label { color: #64748b; font-size: 12px; }
        .card-value { margin-top: 6px; font-size: 22px; font-weight: 900; }
        .table-wrap { overflow: auto; border: 1px solid #e2e8f0; border-radius: 18px; background: #fff; }
        table { width: 100%; border-collapse: collapse; min-width: 1080px; }
        th { text-align: left; font-size: 11px; color: #64748b; padding: 11px 12px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        td { padding: 11px 12px; border-bottom: 1px solid #eef2f7; font-size: 13px; color: #0f172a; vertical-align: middle; }
        .name { font-weight: 900; }
        .phase { display: inline-flex; padding: 5px 10px; border-radius: 999px; background: rgba(9,51,122,.08); color: #09337a; font-size: 11px; font-weight: 900; }
        .sla-pill { display: inline-flex; align-items: center; gap: 0; min-width: 64px; padding: 0; border-radius: 0; font-size: 11px; font-weight: 900; white-space: nowrap; }
        .sla-top { display:flex; align-items:center; gap:0; }
        .sla-dot { min-width: 28px; height: 28px; border-radius: 999px; border: 1px solid transparent; display:inline-flex; align-items:center; justify-content:center; font-size: 11px; line-height: 1; font-weight: 900; box-shadow: none; color: #fff; background: currentColor; padding: 0 8px; }
        .sla-sub { display:none; }
        .message { color: #b91c1c; background: #fff1f2; border: 1px solid #fecdd3; padding: 11px 13px; border-radius: 14px; font-size: 13px; }
        .muted { color: #64748b; font-size: 12px; }
        .action-link { display:inline-flex; min-height: 34px; align-items:center; justify-content:center; border-radius: 10px; border: 1px solid #cbd5e1; padding: 0 10px; text-decoration:none; color:#0f172a; font-weight:800; background:#fff; }
        .pager { display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; }
        .pager-buttons, .inline { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        @media (max-width: 1320px) { .filters-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
        @media (max-width: 900px) { .hero, .filters-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section className="hero">
        <div>
          <span className="eyebrow">Kurumsal CRM · Aktiviteler</span>
          <h1 className="title">Aktivite Dashboard</h1>
          <div className="sub">Aktivite filtreleri sorumlu, ekleyen, bekleyen taraf, tarih aralığı ve SLA bazında genişletildi. SLA alanı sadeleştirildi: tamamlananlar yeşil tik, planlı kayıtlar yeşil gün sayısı, gecikenler kırmızı eksi gün, bekleyenler sarı uyarı olarak görünür.</div>
        </div>
        <Link className="primary" href="/crm/activities/new">+ Aktivite Ekle</Link>
      </section>

      <section className="surface">
        <div className="filters-grid">
          <label className="field"><span className="field-label">Arama</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, aksiyon, not, ekleyen" /></label>
          <label className="field"><span className="field-label">Müşteri Sorumlusu</span><select className="select" value={responsible} onChange={(e) => setResponsible(e.target.value)}><option value="">Tüm Sorumlular</option>{options.responsibleOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Aktiviteyi Giren</span><select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Tüm Kişiler</option>{options.ownerOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Bekleyen Taraf</span><select className="select" value={partnerOwner} onChange={(e) => setPartnerOwner(e.target.value)}><option value="">Tüm Bekleyenler</option>{options.partnerOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">Faz</span><select className="select" value={fazNo} onChange={(e) => setFazNo(e.target.value)}><option value="">Tüm Fazlar</option>{options.phaseOptions.map((v) => <option key={v} value={v}>{`FAZ ${v}`}</option>)}</select></label>
          <label className="field"><span className="field-label">Durum</span><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tüm Durumlar</option>{options.statusOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="field"><span className="field-label">SLA</span><select className="select" value={sla} onChange={(e) => setSla(e.target.value)}><option value="">Tüm SLA</option>{SLA_OPTIONS.filter(Boolean).map((v) => <option key={v} value={v}>{SLA_LABELS[v]}</option>)}</select></label>
          <label className="field"><span className="field-label">Sayfa Boyutu</span><select className="select" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>{PAGE_SIZE_OPTIONS.map((v) => <option key={v} value={v}>{v} / sayfa</option>)}</select></label>
          <label className="field"><span className="field-label">Başlangıç Tarihi</span><input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
          <label className="field"><span className="field-label">Bitiş Tarihi</span><input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
        </div>
        <div className="filter-actions">
          <button className="secondary" onClick={clearFilters}>Filtreyi Temizle</button>
        </div>
      </section>

      <section className="stats">{stats.map((item) => <div key={item.label} className="card"><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div></div>)}</section>
      {msg ? <div className="message">{msg}</div> : null}

      <section className="surface">
        <div className="table-wrap"><table><thead><tr>{['Tarih', 'Müşteri', 'Fazı', 'Ekleyen', 'Bekleyen', 'Sonraki Aksiyon', 'Hedef Tarih', 'SLA', 'İşlem'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{slimRows.map((row) => (<tr key={row.id}><td>{formatDate(row.created_at)}</td><td><div className="name">{row.musteriler?.musteri ?? '-'}</div><div className="muted">Sorumlu: {row.musteriler?.sorumlu ?? '-'}</div></td><td><span className="phase">{row.faz_no != null ? `FAZ ${row.faz_no}` : '-'}</span></td><td>{row.owner ?? '-'}</td><td>{row.partner_owner ?? '-'}</td><td>{row.activity_label ?? '-'}</td><td>{formatDate(row.due_date)}</td><td><span className="sla-pill" style={row.sla.tone}><span className="sla-top"><span className="sla-dot" style={{ backgroundColor: row.sla.dotColor, borderColor: row.sla.dotBorderColor ?? 'transparent', color: row.sla.textColor ?? '#ffffff' }}>{row.sla.dotText || ""}</span><span className="sla-sub">{row.sla.dayText || "-"}</span></span></span></td><td><Link className="action-link" href={`/crm/activities/new?edit=${row.id}`}>Düzenle</Link></td></tr>))}{!loading && !slimRows.length ? <tr><td colSpan={9} style={{ padding: 16, color: '#64748b' }}>Kayıt bulunamadı.</td></tr> : null}{loading ? <tr><td colSpan={9} style={{ padding: 16, color: '#64748b' }}>Yükleniyor...</td></tr> : null}</tbody></table></div>
        <div className="pager"><div className="inline"><span className="muted">Toplam {total} kayıt · Sayfa {page} / {totalPages}</span></div><div className="pager-buttons"><button className="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</button><button className="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki</button></div></div>
      </section>
    </main>
  );
}
