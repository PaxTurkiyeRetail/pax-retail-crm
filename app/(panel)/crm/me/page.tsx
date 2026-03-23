import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import '@/styles/me-page.css';
import { requireCrmAccessOrThrow } from '@/lib/authz';

export default async function MyHomePage() {
  await requireCrmAccessOrThrow();

  return (
    <div className="pax-page-container">

      <SystemRequirementStamp pageKey="me" />

      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Benim Ekranım · Kişisel Komuta Merkezi</span>
        <h1 className="pax-hero-title">Günlük işini, hedeflerini ve AI desteğini tek ekranda gör.</h1>
        <p className="pax-hero-description">
          Müşteri havuzu, teklif ritmi, hedef ilerleme, iletişim analitiği ve AI destek katmanı burada birleşir.
        </p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Müşteri</div><div className="pax-hero-stat-value">24</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Fırsat</div><div className="pax-hero-stat-value">12</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Teklif</div><div className="pax-hero-stat-value">7</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Risk</div><div className="pax-hero-stat-value">3</div></div>
        </div>
      </div>

      <div className="two-col">
        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 20 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Hedef & Gerçekleşen</div>
            <div className="pax-page-sub">Kullanıcı bazlı hedef tabloları bağlandığında gerçek veri ile dolacak.</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-2)' }}>Hedef ilerleme</span>
              <strong style={{ color: 'var(--text)' }}>%64</strong>
            </div>
            <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '64%', background: '#10b981', borderRadius: 999 }} />
            </div>
          </div>
          <div className="two-col">
            <div className="stat-mini"><div className="stat-mini-lbl">Haftalık aktivite</div><div className="stat-mini-val">23</div></div>
            <div className="stat-mini"><div className="stat-mini-lbl">Ort. cevap</div><div className="stat-mini-val">7 sa</div></div>
          </div>
        </div>

        <div className="pax-card">
          <div className="pax-page-header" style={{ marginBottom: 20 }}>
            <div className="pax-page-title" style={{ fontSize: 16 }}>Mail & İletişim Analitiği</div>
            <div className="pax-page-sub">Mail entegrasyonu sonrası gerçek veriye bağlanacak.</div>
          </div>
          <div className="two-col">
            <div className="stat-mini"><div className="stat-mini-lbl">Ortalama mail</div><div className="stat-mini-val">18</div></div>
            <div className="stat-mini"><div className="stat-mini-lbl">Ort. cevap</div><div className="stat-mini-val">7 sa</div></div>
            <div className="stat-mini"><div className="stat-mini-lbl">Cevaplanma</div><div className="stat-mini-val">%74</div></div>
            <div className="stat-mini"><div className="stat-mini-lbl">Takip yoğunluğu</div><div className="stat-mini-val">9</div></div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="risk-box">
          <div className="box-title" style={{ color: '#92400e' }}>Benim Risklerim</div>
          <ul className="box-list" style={{ color: '#78716c' }}>
            <li>• 7 gündür temas bekleyen 3 müşteri</li>
            <li>• Follow-up gerektiren 4 teklif</li>
            <li>• Geri dönüş bekleyen 2 kritik başlık</li>
          </ul>
        </div>
        <div className="ai-box">
          <div className="box-title" style={{ color: '#1e40af' }}>Bana Destek Olan Agentlar</div>
          <ul className="box-list" style={{ color: '#64748b' }}>
            <li>• Follow-up Agent</li>
            <li>• Teklif Hazırlayıcı</li>
            <li>• Müşteri Segmentasyon Agent</li>
            <li>• Haftalık Yönetici Özeti Agent</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
