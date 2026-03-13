'use client';

import { useEffect, useMemo, useState } from 'react';

type ReportRow = {
  musteri: string;
  sektor: string;
  entegrasyon_tipi: string;
  mevcut_faz: string;
  son_aksiyon: string;
  sorumlu: string;
  risk_durumu: string;
  sonraki_adim: string;
  bekleyen_taraf: string;
  kunye_durumu?: string;
  sla_state?: string;
};

type Totals = {
  toplam_musteri: number;
  hamwe_kunye_var: number;
  hamwe_kunye_eksik: number;
  hamwe_kunye_yok: number;
  sla_geciken: number;
  sla_bugun: number;
  sla_planli: number;
  sla_tarihsiz: number;
};

type Highlights = {
  owners: Array<{ label: string; value: number }>;
  waiting: Array<{ label: string; value: number }>;
};

const EMPTY_TOTALS: Totals = { toplam_musteri: 0, hamwe_kunye_var: 0, hamwe_kunye_eksik: 0, hamwe_kunye_yok: 0, sla_geciken: 0, sla_bugun: 0, sla_planli: 0, sla_tarihsiz: 0 };
const EMPTY_HIGHLIGHTS: Highlights = { owners: [], waiting: [] };

export default function ManagementReportPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [highlights, setHighlights] = useState<Highlights>(EMPTY_HIGHLIGHTS);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [waitingFilter, setWaitingFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [kunyeFilter, setKunyeFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/reports/management', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(payload?.message || 'Rapor yüklenemedi');
        setRows([]);
        return;
      }
      setRows(payload.rows ?? []);
      setTotals({ ...EMPTY_TOTALS, ...(payload.totals ?? {}) });
      setHighlights({ ...EMPTY_HIGHLIGHTS, ...(payload.highlights ?? {}) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const needle = q.trim().toLocaleLowerCase('tr');
    if (needle) {
      const haystack = [row.musteri, row.sektor, row.entegrasyon_tipi, row.sorumlu, row.son_aksiyon, row.sonraki_adim, row.bekleyen_taraf].join(' ').toLocaleLowerCase('tr');
      if (!haystack.includes(needle)) return false;
    }
    if (ownerFilter && row.sorumlu !== ownerFilter) return false;
    if (waitingFilter && row.bekleyen_taraf !== waitingFilter) return false;
    if (slaFilter && (row.sla_state ?? 'unscheduled') !== slaFilter) return false;
    const normalizedKunye = (row.kunye_durumu ?? '-') === 'Var' ? 'Tamam' : (row.kunye_durumu ?? '-');
    if (kunyeFilter && normalizedKunye !== kunyeFilter) return false;
    return true;
  }), [rows, q, ownerFilter, waitingFilter, slaFilter, kunyeFilter]);

  const mapped = useMemo(() => filteredRows.map((row, index) => ({ no: index + 1, ...row })), [filteredRows]);
  const completionRate = totals.toplam_musteri ? Math.round((totals.hamwe_kunye_var / totals.toplam_musteri) * 100) : 0;
  const overdueRate = totals.toplam_musteri ? Math.round((totals.sla_geciken / totals.toplam_musteri) * 100) : 0;

  const kpiCards = [
    { label: 'Toplam Portföy', value: totals.toplam_musteri, hint: 'İzlenen müşteri' },
    { label: 'Künye Tamamlanma', value: `%${completionRate}`, hint: `${totals.hamwe_kunye_var} müşteri tam` },
    { label: 'Geciken SLA', value: totals.sla_geciken, hint: `%${overdueRate} portföy riski` },
    { label: 'Bugün Aksiyon', value: totals.sla_bugun, hint: 'Aynı gün takip' },
    { label: 'Planlı Takip', value: totals.sla_planli, hint: 'İleri tarihli' },
    { label: 'Tarihsiz İş', value: totals.sla_tarihsiz, hint: 'Planlama gerekiyor' },
  ];

  const clearFilters = () => {
    setQ('');
    setOwnerFilter('');
    setWaitingFilter('');
    setSlaFilter('');
    setKunyeFilter('');
  };

  return (
    <main className="page">
      <style jsx>{`
        .page { display: grid; gap: 14px; }
        .hero, .surface, .card { border: 1px solid #d7e3ef; background: #fff; border-radius: 22px; box-shadow: 0 16px 36px rgba(8,28,66,.05); }
        .hero, .surface { padding: 18px; }
        .hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; background: linear-gradient(135deg, rgba(6,40,93,.98) 0%, rgba(10,79,163,.95) 100%); color: #fff; }
        .title { margin: 0; font-size: 30px; }
        .sub { color: rgba(255,255,255,.82); font-size: 13px; margin-top: 6px; max-width: 66ch; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn { min-height: 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,.24); background: rgba(255,255,255,.12); color: #fff; font-weight: 700; padding: 0 14px; cursor: pointer; }
        .secondary { min-height: 42px; border-radius: 14px; padding: 0 14px; font-weight: 800; border: 1px solid #d5dee8; background: #fff; color: #0f172a; cursor: pointer; }
        .stats { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 10px; }
        .card { padding: 14px; }
        .card-label { color: #64748b; font-size: 12px; }
        .card-value { color: #0f172a; font-size: 24px; font-weight: 900; margin-top: 4px; }
        .card-hint { color: #64748b; font-size: 12px; margin-top: 6px; }
        .highlights { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        .mini-title { font-size: 13px; font-weight: 900; color: #0f172a; }
        .mini-list { display:grid; gap:8px; margin-top:10px; }
        .mini-item { display:flex; justify-content:space-between; gap:8px; border:1px solid #e2e8f0; border-radius:12px; padding:10px 12px; }
        .filters-grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
        .input { min-height: 42px; border-radius: 14px; border: 1px solid #d5dee8; padding: 0 13px; background: #fff; width: 100%; }
        .field { display:grid; gap:6px; }
        .field-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
        .filter-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:10px; flex-wrap:wrap; }
        .table-wrap { overflow: auto; border: 1px solid #e2e8f0; border-radius: 16px; }
        table { width: 100%; border-collapse: collapse; min-width: 1180px; }
        th { text-align: left; font-size: 11px; color: #64748b; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        td { padding: 10px 12px; border-bottom: 1px solid #eef2f7; font-size: 13px; color: #0f172a; }
        .pill { display:inline-flex; align-items:center; min-height: 28px; padding: 0 10px; border-radius: 999px; font-size: 11px; font-weight: 900; }
        .sla-overdue { background:#fef2f2; color:#b91c1c; }
        .sla-today { background:#fff7ed; color:#b45309; }
        .sla-upcoming { background:#ecfdf3; color:#166534; }
        .sla-unscheduled { background:#f8fafc; color:#475569; }
        .sla-completed { background:#ecfdf3; color:#166534; }
        .message { color: #b91c1c; background: #fff1f2; border: 1px solid #fecdd3; padding: 10px 12px; border-radius: 12px; font-size: 13px; }
        @media (max-width: 1280px) { .stats { grid-template-columns: repeat(3, minmax(0,1fr)); } .highlights { grid-template-columns: 1fr; } .filters-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 920px) { .stats, .filters-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section className="hero"><div><h1 className="title">Yönetim Dashboard</h1><div className="sub">Faz yoğunluğu kaldırıldı. Yönetim bakışını sorumlu sahipliği, bekleyen taraf baskısı ve SLA-künye sağlığı üzerinde topladım.</div></div><div className="actions"><button className="btn" onClick={load} disabled={loading}>{loading ? 'Yükleniyor...' : 'Yenile'}</button></div></section>
      <section className="stats">{kpiCards.map((item) => <div key={item.label} className="card"><div className="card-label">{item.label}</div><div className="card-value">{item.value}</div><div className="card-hint">{item.hint}</div></div>)}</section>
      <section className="highlights"><div className="card"><div className="mini-title">Portföy Sahipliği</div><div className="mini-list">{highlights.owners.map((item) => <div key={item.label} className="mini-item"><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div><div className="card"><div className="mini-title">Bekleyen Taraf</div><div className="mini-list">{highlights.waiting.map((item) => <div key={item.label} className="mini-item"><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div></section>
      <section className="surface"><div className="filters-grid"><label className="field"><span className="field-label">Arama</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, sektör, owner, aksiyon" /></label><label className="field"><span className="field-label">Sorumlu</span><select className="input" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option value="">Tüm Sorumlular</option>{highlights.owners.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}</select></label><label className="field"><span className="field-label">Bekleyen Taraf</span><select className="input" value={waitingFilter} onChange={(e) => setWaitingFilter(e.target.value)}><option value="">Tüm Bekleyenler</option>{highlights.waiting.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}</select></label><label className="field"><span className="field-label">SLA</span><select className="input" value={slaFilter} onChange={(e) => setSlaFilter(e.target.value)}><option value="">Tüm SLA</option><option value="overdue">Geciken</option><option value="today">Bugün</option><option value="upcoming">Planlı</option><option value="completed">Tamamlanan</option><option value="unscheduled">Tarihsiz</option></select></label><label className="field"><span className="field-label">Künye Durumu</span><select className="input" value={kunyeFilter} onChange={(e) => setKunyeFilter(e.target.value)}><option value="">Tüm Künye Durumları</option><option value="Tamam">Tamam</option><option value="Eksik">Eksik</option><option value="Yok">Yok</option></select></label><label className="field"><span className="field-label">Görünüm</span><div className="input" style={{display:'flex',alignItems:'center'}}>Filtrelenmiş müşteri sayısı: <strong style={{marginLeft:6}}>{filteredRows.length}</strong></div></label></div><div className="filter-actions"><button className="secondary" onClick={clearFilters}>Filtreyi Temizle</button></div></section>
      {msg ? <div className="message">{msg}</div> : null}
      <section className="surface"><div className="table-wrap"><table><thead><tr>{['No', 'Müşteri', 'Sektör', 'Entegrasyon Tipi', 'Mevcut Faz', 'Son Aksiyon', 'Sorumlu', 'Sonraki Adım', 'Bekleyen Taraf', 'SLA', 'Künye'].map((h) => (<th key={h}>{h}</th>))}</tr></thead><tbody>{mapped.map((r) => (<tr key={`${r.no}-${r.musteri}`}><td>{r.no}</td><td style={{ fontWeight: 800 }}>{r.musteri}</td><td>{r.sektor}</td><td>{r.entegrasyon_tipi}</td><td>{r.mevcut_faz}</td><td>{r.son_aksiyon}</td><td>{r.sorumlu}</td><td>{r.sonraki_adim}</td><td>{r.bekleyen_taraf}</td><td><span className={`pill sla-${r.sla_state || 'unscheduled'}`}>{r.sla_state === 'overdue' ? 'Geciken' : r.sla_state === 'today' ? 'Bugün' : r.sla_state === 'upcoming' ? 'Planlı' : r.sla_state === 'completed' ? 'Tamamlanan' : 'Tarihsiz'}</span></td><td>{r.kunye_durumu === 'Var' ? 'Tamam' : (r.kunye_durumu ?? '-')}</td></tr>))}{!mapped.length ? <tr><td colSpan={11} style={{ padding: 16, color: '#64748b' }}>Kayıt yok.</td></tr> : null}</tbody></table></div></section>
    </main>
  );
}
