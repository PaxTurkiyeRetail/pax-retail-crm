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
          <div>
            <div className="det-kicker">Momentum Paneli</div>
            <div className="det-big">%{slaHealthPct}</div>
            <div className="det-sub">SLA sağlığı · haftalık tempo · risk görünümü</div>
          </div>

          <div className="mom-grid">
            <div className="mom-box">
              <span>Aktivite Momentum</span>
              <strong>{dashboardMetrics.momentumPct > 0 ? '+' : ''}{dashboardMetrics.momentumPct}%</strong>
              <em className={momentumPositive ? 'pos' : momentumNegative ? 'neg' : 'neu'}>
                Önceki 7 güne göre {dashboardMetrics.currentWeekCount} aktivite
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
                <div className="trend-lbl">Haftalık Trend</div>
                <div className="trend-sub">Bu hafta içi dağılımı</div>
              </div>
              <div className="trend-total">{dashboardMetrics.trendTotal}</div>
            </div>
            <div className="trend-bars">
              {dashboardMetrics.trend.map((item) => (
                <div key={item.key} className="tcol">
                  <div className="tval">{item.count}</div>
                  <div className="trail">
                    <div className="tbar" style={{ height: `${Math.max(4, Math.round((item.count / dashboardMetrics.trendMax) * 56))}px` }} />
                  </div>
                  <div className="tlabel">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kart 2: Faz Dağılımı */}
        <div className="det-card">
          <div>
            <div className="det-kicker">Firma Bazlı Faz Dağılımı</div>
            <div className="det-big">{companyPhase.totalFirms}</div>
            <div className="det-sub">Toplam firma · Son aktivite fazına göre</div>
          </div>
          <div className="bar-rows">
            {companyPhase.list.map((p) => (
              <div key={p.key} className="bar-row">
                <span>{p.title}</span>
                <div className="bar"><div className="bar-fill" style={{ width: `${p.pct}%` }} /></div>
                <em>{p.count} firma</em>
                <strong>%{p.pct}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Kart 3: Ekip & Risk */}
        <div className="det-card">
          <div className="det-kicker">Ekip & Risk</div>

          <div className="leader-list">
            {leaderboard.map((p, i) => (
              <div key={p.title} className="leader-row">
                <span className="rank">{i + 1}</span>
                <div>
                  <div className="leader-name">{p.title}</div>
                  <div className="leader-sub">{p.totalCount} aktivite · {p.firms} firma</div>
                </div>
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
              <div className="rr-val" style={{ fontSize: 16, paddingTop: 4 }}>{riskByPhase?.title ?? '-'}</div>
            </div>
            <div className="rr-box">
              <div className="rr-lbl">Hedef Tarih</div>
              <div className="rr-val" style={{ fontSize: 14, paddingTop: 4 }}>
                Geciken {dueDateAnalysis.overdue} · %{dueDateAnalysis.overduePct}
              </div>
              <div className="rr-sub">Bugün {dueDateAnalysis.dueToday} · Zamanında {dueDateAnalysis.onTime}</div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
