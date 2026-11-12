'use client';
import '@/styles/activities-dashboard.css';

import Link from 'next/link';

// Aktiviteler sayfası — kompakt hero + tek satırlık analitik bandı.
// Her sayı tek yerde: toplam aktivite listenin başlık rozetinde, burada yalnız
// dönemin firma / tamamlanma / gecikme / blokaj özeti ve dağılımlar durur.

type PhaseBucket = { key: string; title: string; range?: string; count: number; pct: number };
type PersonRow = { title: string; totalCount: number; firms: number };

type DashboardMetrics = {
  atRiskFirmCount: number;
  trend: Array<{ key: string; label: string; count: number; today?: boolean }>;
  trendMax: number;
  trendTitle: string;
  blockedCount: number;
  blockedFirmCount: number;
};

type DueDateAnalysis = {
  overdue: number;
  dueToday: number;
};

type Props = {
  activityTotal: number;
  completedTotal: number;
  completedPct: number;
  dashboardMetrics: DashboardMetrics;
  companyPhase: { totalFirms: number; list: PhaseBucket[] };
  leaderboard: PersonRow[];
  salesTotal: number;
  rsTotal: number;
  dueDateAnalysis: DueDateAnalysis;
};

const PHASE_COLORS: Record<string, string> = {
  lead: '#6366f1',
  first: '#0ea5e9',
  business: '#8b5cf6',
  ops: '#f59e0b',
  rollout: '#10b981',
};

const fmt = (value: number) => value.toLocaleString('tr-TR');

export default function ActivitiesDashboard({
  activityTotal,
  completedTotal,
  completedPct,
  dashboardMetrics,
  companyPhase,
  leaderboard,
  salesTotal,
  rsTotal,
  dueDateAnalysis,
}: Props) {
  const perFirm = companyPhase.totalFirms ? activityTotal / companyPhase.totalFirms : 0;
  const roleTotal = salesTotal + rsTotal;
  const salesPct = roleTotal ? Math.round((salesTotal / roleTotal) * 100) : 0;
  const trend = dashboardMetrics.trend;
  const dense = trend.length > 10;
  const labelStep = trend.length > 16 ? 5 : trend.length > 10 ? 2 : 1;

  return (
    <>
      <section className="pax-hero act-hero">
        <div className="act-hero-text">
          <h1 className="pax-hero-title">Aktiviteler</h1>
          <p className="pax-hero-description">Seçili dönemin temasları; faz, SLA ve blokaj durumuyla.</p>
        </div>
        <Link href="/crm/activities/new" className="act-hero-btn">
          <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Aktivite ekle
        </Link>
      </section>

      <div className="act-band">
        <div className="act-kpis">
          <div className="act-kpi" style={{ boxShadow: 'inset 3px 0 0 #4f46e5' }}>
            <span className="act-kpi-label">Temas edilen firma</span>
            <div className="act-kpi-row">
              <strong className="act-kpi-value">{fmt(companyPhase.totalFirms)}</strong>
              <span className="act-kpi-hint">{companyPhase.totalFirms ? `firma başı ${perFirm.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '—'}</span>
            </div>
          </div>
          <div className="act-kpi" style={{ boxShadow: 'inset 3px 0 0 #16a34a' }}>
            <span className="act-kpi-label">Tamamlanan</span>
            <div className="act-kpi-row">
              <strong className="act-kpi-value">{fmt(completedTotal)} <small>%{completedPct}</small></strong>
            </div>
            <span className="act-kpi-bar"><span style={{ width: `${completedPct}%`, background: '#16a34a' }} /></span>
          </div>
          <div className="act-kpi" style={{ boxShadow: 'inset 3px 0 0 #e11d48' }}>
            <span className="act-kpi-label">Geciken</span>
            <div className="act-kpi-row">
              <strong className={`act-kpi-value${dueDateAnalysis.overdue > 0 ? ' neg' : ''}`}>{fmt(dueDateAnalysis.overdue)}</strong>
              <span className="act-kpi-hint">{dashboardMetrics.atRiskFirmCount} firma · bugün {dueDateAnalysis.dueToday}</span>
            </div>
          </div>
          <div className="act-kpi" style={{ boxShadow: 'inset 3px 0 0 #f59e0b' }}>
            <span className="act-kpi-label">Blokajlı</span>
            <div className="act-kpi-row">
              <strong className="act-kpi-value">{fmt(dashboardMetrics.blockedCount)}</strong>
              <span className="act-kpi-hint">{dashboardMetrics.blockedFirmCount} firma</span>
            </div>
          </div>
        </div>

        <div className="act-panel">
          <div className="act-panel-title">{dashboardMetrics.trendTitle}</div>
          <div className={`act-trend${dense ? ' dense' : ''}`}>
            {trend.map((item, index) => (
              <div key={item.key} className={`act-tcol${item.today ? ' today' : ''}`} title={`${item.label}: ${item.count}`}>
                {!dense ? <span className="act-tval">{item.count || ''}</span> : null}
                <span className="act-tbar" style={{ height: `${Math.max(3, Math.round((item.count / dashboardMetrics.trendMax) * 52))}px`, opacity: item.count ? 1 : 0.28 }} />
                <span className="act-tlabel">{index % labelStep === 0 ? item.label : ' '}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="act-panel">
          <div className="act-panel-title" title="Her firma son aktivitesinin fazına göre sayılır">Faz dağılımı <span>firma</span></div>
          <div className="act-bars">
            {companyPhase.list.map((p) => (
              <div key={p.key} className="act-bar-row" title={p.range}>
                <span className="act-bar-name">{p.title}</span>
                <span className="act-bar"><span style={{ width: `${p.pct}%`, background: PHASE_COLORS[p.key] ?? 'var(--accent)' }} /></span>
                <strong>{p.count}</strong>
                <em>%{p.pct}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="act-panel">
          <div className="act-panel-title">En aktif ekip <span>aktivite</span></div>
          <div className="act-leaders">
            {leaderboard.length ? leaderboard.map((p, i) => (
              <div key={p.title} className="act-leader">
                <span className="act-rank">{i + 1}</span>
                <span className="act-leader-name" title={p.title}>{p.title}</span>
                <span className="act-leader-sub">{p.firms} firma</span>
                <strong>{p.totalCount}</strong>
              </div>
            )) : <div className="act-empty">Bu dönemde aktivite yok.</div>}
          </div>
          <div className="act-split" title={`Sales ${salesTotal} · Retail Support ${rsTotal}`}>
            <span className="act-split-bar">
              <span style={{ width: `${roleTotal ? salesPct : 0}%`, background: '#4f46e5' }} />
              <span style={{ width: `${roleTotal ? 100 - salesPct : 0}%`, background: '#0ea5e9' }} />
            </span>
            <span className="act-split-legend">
              <span><i style={{ background: '#4f46e5' }} />Sales <b>{salesTotal}</b></span>
              <span><i style={{ background: '#0ea5e9' }} />Retail Support <b>{rsTotal}</b></span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
