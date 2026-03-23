'use client';

export default function QuoteHeroDashboard() {
  const stats = { draft: 5, sent: 12, won: 3 };

  return (
    <div className="pax-hero">
      <span className="pax-hero-eyebrow">Teklif Yönetimi</span>
      <h1 className="pax-hero-title">Quote Builder</h1>
      <p className="pax-hero-description">
        Ürün ve adet gir, sistem fiyat baremini otomatik seçsin. Teklif portföyünü buradan takip et.
      </p>
      <div className="pax-grid-4" style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Taslak</div>
          <div className="pax-hero-stat-value">{stats.draft}</div>
        </div>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Gönderildi</div>
          <div className="pax-hero-stat-value">{stats.sent}</div>
        </div>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Kazanılan</div>
          <div className="pax-hero-stat-value">{stats.won}</div>
        </div>
        <div className="pax-hero-stat">
          <div className="pax-hero-stat-label">Toplam</div>
          <div className="pax-hero-stat-value">{stats.draft + stats.sent + stats.won}</div>
        </div>
      </div>
    </div>
  );
}
