'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import '@/styles/phase-report.css';

type MacroGroup = 'Fazsız' | 'Fırsat' | 'İlk Temas' | 'Business' | 'Operasyon' | 'Yayılım';

const MACRO_ORDER: MacroGroup[] = ['Fırsat', 'İlk Temas', 'Business', 'Operasyon', 'Yayılım', 'Fazsız'];

const GROUP_META: Record<MacroGroup, { color: string; bg: string; border: string; dot: string; label: string }> = {
  'Fırsat':    { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', dot: '#7c3aed', label: 'Fırsat' },
  'İlk Temas': { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', label: 'İlk Temas' },
  'Business':  { color: '#92400e', bg: '#fef3c7', border: '#fde68a', dot: '#f59e0b', label: 'Business' },
  'Operasyon': { color: '#9f1239', bg: '#fff1f2', border: '#fecdd3', dot: '#fb7185', label: 'Operasyon' },
  'Yayılım':   { color: '#14532d', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', label: 'Yayılım' },
  'Fazsız':    { color: '#374151', bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af', label: 'Faz Girilmemiş' },
};

type PhaseRow = {
  musteri_id: string;
  musteri: string;
  sorumlu: string;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  macro_group: MacroGroup;
  sektor: string;
  entegrasyon_tipi: string;
  kunye_durumu: 'Var' | 'Eksik' | 'Yok';
};

type GroupSummary = { group: MacroGroup; total: number; withPhase: number; withoutPhase: number };
type PhaseBreakdown = { group: MacroGroup; faz_no: number | null; faz_adi: string | null; count: number };

type Payload = {
  sellerOptions: string[];
  selectedSeller: string;
  rows: PhaseRow[];
  groupSummary: GroupSummary[];
  phaseBreakdown: PhaseBreakdown[];
  totals: { total: number; withPhase: number; withoutPhase: number; phaseCoveragePct: number };
};

const EMPTY: Payload = {
  sellerOptions: [], selectedSeller: '', rows: [], groupSummary: [], phaseBreakdown: [],
  totals: { total: 0, withPhase: 0, withoutPhase: 0, phaseCoveragePct: 0 },
};

const KUNYE_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'Var':   { label: 'Tamam', color: '#14532d', bg: '#f0fdf4', border: '#bbf7d0' },
  'Eksik': { label: 'Eksik', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  'Yok':   { label: 'Yok',   color: '#9f1239', bg: '#fff1f2', border: '#fecdd3' },
};

export default function PhaseReportPage() {
  const [payload, setPayload] = useState<Payload>(EMPTY);
  const [seller, setSeller] = useState('');
  const [activeGroup, setActiveGroup] = useState<MacroGroup | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'musteri' | 'faz_no' | 'sektor' | 'kunye'>('faz_no');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = useCallback(async (sel?: string) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (sel) params.set('seller', sel);
      const res = await fetch(`/api/reports/phase-report${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json?.message || 'Rapor yüklenemedi.'); setPayload(EMPTY); return; }
      const merged = { ...EMPTY, ...json };
      setPayload(merged);
      if (!sel && merged.selectedSeller) setSeller(merged.selectedSeller);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSeller = (val: string) => { setSeller(val); setActiveGroup('all'); void load(val); };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  // Filtrelenmiş + sıralanmış satırlar
  const filteredRows = useMemo(() => {
    let rows = payload.rows;
    if (activeGroup !== 'all') rows = rows.filter(r => r.macro_group === activeGroup);
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('tr');
      rows = rows.filter(r =>
        r.musteri.toLocaleLowerCase('tr').includes(q) ||
        r.sektor.toLocaleLowerCase('tr').includes(q) ||
        (r.aktif_faz_adi ?? '').toLocaleLowerCase('tr').includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'musteri') cmp = a.musteri.localeCompare(b.musteri, 'tr');
      else if (sortBy === 'faz_no') {
        if (a.aktif_faz_no == null && b.aktif_faz_no == null) cmp = 0;
        else if (a.aktif_faz_no == null) cmp = 1;
        else if (b.aktif_faz_no == null) cmp = -1;
        else cmp = a.aktif_faz_no - b.aktif_faz_no;
      }
      else if (sortBy === 'sektor') cmp = a.sektor.localeCompare(b.sektor, 'tr');
      else if (sortBy === 'kunye') cmp = a.kunye_durumu.localeCompare(b.kunye_durumu, 'tr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [payload.rows, activeGroup, search, sortBy, sortDir]);

  // Seçilen gruba ait faz kırılımı
  const activeBreakdown = useMemo(() => {
    const group = activeGroup === 'all' ? null : activeGroup;
    return payload.phaseBreakdown.filter(b => group === null || b.group === group);
  }, [payload.phaseBreakdown, activeGroup]);

  const SortTh = ({ col, children }: { col: typeof sortBy; children: React.ReactNode }) => (
    <th className="sortable" onClick={() => handleSort(col)}>
      {children}
      <span className={`sort-icon ${sortBy === col ? 'on' : ''}`}>
        {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  );

  return (
    <main className="ph-page">

      {/* ── HEADER BAR ── */}
      <div className="ph-topbar">
        <div className="ph-topbar-left">
          <span className="ph-eyebrow">Faz Raporu</span>
          <span className="ph-beta-tag">BETA</span>
        </div>
        <div className="ph-topbar-right">
          <div className="ph-field">
            <label>Satıcı</label>
            <select className="ph-select" value={seller} onChange={e => handleSeller(e.target.value)}>
              {payload.sellerOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="ph-field">
            <label>Firma ara</label>
            <input className="ph-input" placeholder="İsim, sektör, faz…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="ph-kpi-strip">
        <div className="ph-kpi-item">
          <div className="ph-kpi-num">{payload.totals.total}</div>
          <div className="ph-kpi-lbl">Toplam firma</div>
        </div>
        <div className="ph-kpi-sep" />
        <div className="ph-kpi-item">
          <div className="ph-kpi-num green">{payload.totals.withPhase}</div>
          <div className="ph-kpi-lbl">Faz girilmiş</div>
        </div>
        <div className="ph-kpi-sep" />
        <div className="ph-kpi-item">
          <div className="ph-kpi-num amber">{payload.totals.withoutPhase}</div>
          <div className="ph-kpi-lbl">Faz girilmemiş</div>
        </div>
        <div className="ph-kpi-sep" />
        <div className="ph-kpi-item">
          <div className="ph-kpi-num">%{payload.totals.phaseCoveragePct}</div>
          <div className="ph-kpi-lbl">Faz kapsaması</div>
        </div>
        {loading && <div className="ph-loading-dot" />}
      </div>

      {error && <div className="ph-error">{error}</div>}

      {/* ── GRUP KARTLARI ── */}
      <div className="ph-groups">
        {/* "Tümü" kartı */}
        <button
          className={`ph-group-card ${activeGroup === 'all' ? 'active-all' : ''}`}
          onClick={() => setActiveGroup('all')}
        >
          <div className="ph-gc-top">
            <span className="ph-gc-name">Tümü</span>
            <span className="ph-gc-count">{payload.totals.total}</span>
          </div>
          <div className="ph-gc-bar-track">
            <div className="ph-gc-bar" style={{ width: '100%', background: '#94a3b8' }} />
          </div>
        </button>

        {/* Grup kartları */}
        {payload.groupSummary.filter(g => g.total > 0).map(g => {
          const meta = GROUP_META[g.group];
          const pct = payload.totals.total ? Math.round((g.total / payload.totals.total) * 100) : 0;
          const isActive = activeGroup === g.group;
          // Bu gruba ait faz numaralarını bul
          const breakdown = payload.phaseBreakdown.filter(b => b.group === g.group && b.faz_no != null);
          return (
            <button
              key={g.group}
              className={`ph-group-card ${isActive ? 'active' : ''}`}
              style={isActive ? { borderColor: meta.border, background: meta.bg } : {}}
              onClick={() => setActiveGroup(isActive ? 'all' : g.group)}
            >
              <div className="ph-gc-top">
                <span className="ph-gc-dot" style={{ background: meta.dot }} />
                <span className="ph-gc-name" style={isActive ? { color: meta.color } : {}}>{meta.label}</span>
                <span className="ph-gc-count" style={isActive ? { color: meta.color } : {}}>{g.total}</span>
              </div>

              {/* Mini faz numarası listesi */}
              {breakdown.length > 0 && (
                <div className="ph-gc-phases">
                  {breakdown.slice(0, 4).map(b => (
                    <span key={b.faz_no} className="ph-gc-phase-chip" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                      F{b.faz_no} · {b.count}
                    </span>
                  ))}
                  {breakdown.length > 4 && (
                    <span className="ph-gc-phase-more">+{breakdown.length - 4}</span>
                  )}
                </div>
              )}

              {/* Faz girilmemiş uyarısı */}
              {g.group !== 'Fazsız' && g.withoutPhase > 0 && (
                <div className="ph-gc-warn">
                  {g.withoutPhase} firmada faz no girilmemiş
                </div>
              )}

              {/* Progress bar */}
              <div className="ph-gc-bar-track">
                <div className="ph-gc-bar" style={{ width: `${pct}%`, background: meta.dot }} />
              </div>
              <div className="ph-gc-pct">{pct}% toplam</div>
            </button>
          );
        })}
      </div>

      {/* ── FİRMA TABLOSU ── */}
      <div className="ph-table-card">
        {/* Tablo başlığı */}
        <div className="ph-table-header">
          <div className="ph-table-title">
            {activeGroup === 'all' ? 'Tüm firmalar' : (
              <span style={{ color: GROUP_META[activeGroup].color }}>
                <span className="ph-th-dot" style={{ background: GROUP_META[activeGroup].dot }} />
                {GROUP_META[activeGroup].label}
              </span>
            )}
          </div>
          <div className="ph-table-meta">
            <span className="ph-count-badge">{filteredRows.length} firma</span>
            {activeGroup !== 'all' && activeBreakdown.length > 0 && (
              <div className="ph-inline-breakdown">
                {activeBreakdown.map(b => (
                  <span key={`${b.faz_no}`} className="ph-ib-chip" style={{
                    background: GROUP_META[b.group].bg,
                    color: GROUP_META[b.group].color,
                    border: `1px solid ${GROUP_META[b.group].border}`,
                  }}>
                    {b.faz_no == null ? 'Faz yok' : `F${b.faz_no}`} · {b.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fazsız grubu seçiliyse not */}
        {activeGroup === 'Fazsız' && (
          <div className="ph-info-banner">
            Bu firmalarda henüz hiç faz numarası girilmemiş. Aktivite kaydederken faz seçilmesi gerekiyor.
          </div>
        )}

        <div className="ph-table-wrap">
          <table className="ph-table">
            <thead>
              <tr>
                <SortTh col="musteri">Firma</SortTh>
                <SortTh col="faz_no">Faz</SortTh>
                <th>Grup</th>
                <SortTh col="sektor">Sektör</SortTh>
                <SortTh col="kunye">Künye</SortTh>
                <th>Entegrasyon</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr><td colSpan={6} className="ph-empty-td">
                  {search ? `"${search}" için sonuç yok` : 'Firma bulunamadı'}
                </td></tr>
              )}
              {filteredRows.map(row => {
                const meta = GROUP_META[row.macro_group];
                const kunye = KUNYE_BADGE[row.kunye_durumu] ?? KUNYE_BADGE['Yok'];
                const isNoPhase = row.aktif_faz_no == null;
                return (
                  <tr key={row.musteri_id} className={isNoPhase ? 'row-nophase' : ''}>
                    {/* Firma */}
                    <td>
                      <div className="td-firm">
                        <span className="td-firm-name">{row.musteri}</span>
                        {isNoPhase && <span className="td-nophase-tag">faz yok</span>}
                      </div>
                    </td>
                    {/* Faz */}
                    <td>
                      {isNoPhase ? (
                        <span className="td-faz-empty">—</span>
                      ) : (
                        <div className="td-faz">
                          <span className="td-faz-badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                            Faz {row.aktif_faz_no}
                          </span>
                          {row.aktif_faz_adi && <span className="td-faz-name">{row.aktif_faz_adi}</span>}
                        </div>
                      )}
                    </td>
                    {/* Grup */}
                    <td>
                      <span className="td-group" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        <i style={{ background: meta.dot }} />
                        {meta.label}
                      </span>
                    </td>
                    {/* Sektör */}
                    <td className="td-muted">{row.sektor}</td>
                    {/* Künye */}
                    <td>
                      <span className="td-kunye" style={{ background: kunye.bg, color: kunye.color, border: `1px solid ${kunye.border}` }}>
                        {kunye.label}
                      </span>
                    </td>
                    {/* Entegrasyon */}
                    <td className="td-muted td-sm">{row.entegrasyon_tipi}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
