'use client';
import '@/styles/activities-dashboard.css';

// Aktiviteler sayfası — Hero + detay dashboard bölümü
// Hero: kompakt, tüm sayfalarla aynı yükseklikte
// Detay kartları: hero altında ayrı bölüm

type PhaseBucket = { key: string; title: string; count: number; pct: number };
type PersonRow = { title: string; totalCount: number; firms: number };

type DashboardMetrics = {
  momentumPct: number;
  currentWeekCount: number;
  atRiskFirmCount: number;
  newFirmsThisWeek: number;
  avgPerFirm: string;
  trend: Array<{ key: string; label: string; count: number }>;
  trendTotal: number;
  trendMax: number;
  blockedCount?: number;
  blockedFirmCount?: number;
};

type DueDateAnalysis = {
  overdue: number;
  dueToday: number;
  onTime: number;
  overduePct: number;
};

type Props = {
  slaHealthPct: number;
  dashboardMetrics: DashboardMetrics;
  companyPhase: { totalFirms: number; list: PhaseBucket[] };
  leaderboard: PersonRow[];
  riskByPhase?: { title: string } | null;
  salesTotal: number;
  rsTotal: number;
  dueDateAnalysis: DueDateAnalysis;
};

export default function ActivitiesDashboard({
  slaHealthPct,
  dashboardMetrics,
  companyPhase,
  leaderboard,
  riskByPhase,
  salesTotal,
  rsTotal,
  dueDateAnalysis,
}: Props) {
  const momentumPositive = dashboardMetrics.momentumPct > 0;
  const momentumNegative = dashboardMetrics.momentumPct < 0;

  return (
    <>

      {/* ── KOMPAKT HERO — tüm sayfalarla aynı yükseklik ── */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Aktivite Merkezi</span>
        <h1 className="pax-hero-title">Aktivite Dashboard</h1>
        <p className="pax-hero-description">
          SLA sağlığı, haftalık tempo, faz dağılımı ve ekip performansı tek bakışta.
        </p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">SLA Sağlığı</div>
            <div className="pax-hero-stat-value">%{slaHealthPct}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Bu Hafta</div>
            <div className="pax-hero-stat-value">{dashboardMetrics.currentWeekCount}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Riskli Firma</div>
            <div className="pax-hero-stat-value">{dashboardMetrics.atRiskFirmCount}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Toplam Firma</div>
            <div className="pax-hero-stat-value">{companyPhase.totalFirms}</div>
          </div>
        </div>
      </div>

      {/* ── DETAY KARTLARI (hero altında, beyaz kart stilinde) ── */}
      <div className="detail-grid">

        {/* Kart 1: Momentum */}
        <div className="det-card">
          <div className="det-head">
            <div className="det-kicker">Momentum</div>
            <span className="det-chip" title="SLA sağlığı">SLA %{slaHealthPct}</span>
          </div>

          <div className="mom-split">
          <div className="mom-grid">
            <div className="mom-box">
              <span>Aktivite Momentum</span>
              <strong>{dashboardMetrics.momentumPct > 0 ? '+' : ''}{dashboardMetrics.momentumPct}%</strong>
              <em className={momentumPositive ? 'pos' : momentumNegative ? 'neg' : 'neu'}>
                Önceki 7 güne göre
              </em>
            </div>
            <div className="mom-box">
              <span>Riskli Firma</span>
              <strong>{dashboardMetrics.atRiskFirmCount}</strong>
              <em className="neg">Geciken aksiyon</em>
            </div>
            <div className="mom-box">
              <span>Yeni Firma</span>
              <strong>{dashboardMetrics.newFirmsThisWeek}</strong>
              <em className="pos">Son 7 günde</em>
            </div>
            <div className="mom-box">
              <span>Firma Başı</span>
              <strong>{dashboardMetrics.avgPerFirm}</strong>
              <em className="neu">Ort. aktivite</em>
            </div>
          </div>

          <div className="trend-wrap">
            <div className="trend-head">
              <div>
                <div className="trend-lbl">Haftalık trend</div>
              </div>
              <div className="trend-total">{dashboardMetrics.trendTotal}</div>
            </div>
            <div className="trend-bars">
              {dashboardMetrics.trend.map((item) => (
                <div key={item.key} className="tcol">
                  <div className="tval">{item.count}</div>
                  <div className="trail">
                    <div className="tbar" style={{ height: `${Math.max(4, Math.round((item.count / dashboardMetrics.trendMax) * 44))}px` }} />
                  </div>
                  <div className="tlabel">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Kart 2: Faz Dağılımı */}
        <div className="det-card">
          <div className="det-head">
            <div className="det-kicker" title="Her firma son aktivitesinin fazına göre sayılır">Faz dağılımı</div>
            <span className="det-chip">{companyPhase.totalFirms} firma</span>
          </div>
          <div className="bar-rows">
            {companyPhase.list.map((p) => (
              <div key={p.key} className="bar-row">
                <span>{p.title}</span>
                <div className="bar"><div className="bar-fill" style={{ width: `${p.pct}%` }} /></div>
                <em>{p.count}</em>
                <strong>%{p.pct}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Kart 3: Ekip & Risk */}
        <div className="det-card">
          <div className="det-head">
            <div className="det-kicker">Ekip ve risk</div>
          </div>

          <div className="leader-list">
            {leaderboard.map((p, i) => (
              <div key={p.title} className="leader-row">
                <span className="rank">{i + 1}</span>
                <div className="leader-name">{p.title}</div>
                <div className="leader-sub">{p.firms} firma</div>
                <div className="score">{p.totalCount}</div>
              </div>
            ))}
          </div>

          <div className="role-risk">
            <div className="rr-box">
              <div className="rr-lbl">Sales</div>
              <div className="rr-val">{salesTotal}</div>
            </div>
            <div className="rr-box">
              <div className="rr-lbl">Retail Support</div>
              <div className="rr-val">{rsTotal}</div>
            </div>
            <div className="rr-box">
              <div className="rr-lbl">En Yoğun Faz</div>
              <div className="rr-val">{riskByPhase?.title ?? '—'}</div>
            </div>
            <div className="rr-box" title={`Geciken %${dueDateAnalysis.overduePct} · Bugün ${dueDateAnalysis.dueToday} · Zamanında ${dueDateAnalysis.onTime}`}>
              <div className="rr-lbl">Geciken</div>
              <div className={`rr-val${dueDateAnalysis.overdue > 0 ? ' neg' : ''}`}>{dueDateAnalysis.overdue}</div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
