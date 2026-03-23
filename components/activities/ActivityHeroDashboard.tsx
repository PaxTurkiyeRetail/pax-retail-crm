'use client';

export default function ActivityHeroDashboard() {
  const stats = { today: 12, thisWeek: 45, pending: 8 };

  return (
    <div className="pax-hero">
      <span className="pax-hero-eyebrow">Aktivite Merkezi</span>
      <h1 className="pax-hero-title">Aktivite Girişi</h1>
      <p className="pax-hero-description">
        Müşteri ziyareti, toplantı veya görüşme kaydı oluşturun. Tüm temas geçmişi burada izlenir.
      </p>
      <div className="pax-grid-4" style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Bugün</div>
          <div className="pax-hero-stat-value">{stats.today}</div>
        </div>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Bu Hafta</div>
          <div className="pax-hero-stat-value">{stats.thisWeek}</div>
        </div>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Bekleyen</div>
          <div className="pax-hero-stat-value">{stats.pending}</div>
        </div>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Tamamlanan</div>
          <div className="pax-hero-stat-value">{stats.thisWeek - stats.pending}</div>
        </div>
      </div>
    </div>
  );
}
