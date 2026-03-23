'use client';

export default function NovaHybridModelTab({ userRole, onComplete }: any) {
  const roleMessages: Record<string, string> = {
    sales: "Satış olarak senin günlük işin: CRM'de müşteri takibi, teklif hazırlama ve follow-up. AI agentlar sana hatırlatıcı gönderir, otomatik mail taslaklarını hazırlar ve pipeline forecast'ı sunar.",
    support: "Support olarak senin günlük işin: JIRA ticket yönetimi, müşteri sorunlarını çözme ve SLA takibi. AI agentlar ticket'ları otomatik kategorize eder, çözüm önerileri sunar ve kritik durumları escalate eder.",
    marketing: "Marketing olarak senin günlük işin: İçerik üretimi, kampanya yönetimi ve sosyal medya. AI agentlar blog yazıları hazırlar, görselleri tasarlar ve SEO optimizasyonu yapar.",
    pmo: "PMO olarak senin günlük işin: Proje takibi, kaynak planlaması ve raporlama. AI agentlar toplantı özetlerini çıkarır, timeline optimizasyonu yapar ve otomatik durum raporları oluşturur."
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="pax-card">
        <div className="pax-label" style={{ marginBottom: 12 }}>5. HİBRİT MODEL</div>
        <h2 style={{ 
          fontSize: 32, 
          fontWeight: 800, 
          lineHeight: 1.2,
          marginBottom: 16,
          color: 'var(--text)'
        }}>
          Senin günlük işin nasıl değişecek?
        </h2>

        <div style={{ 
          background: '#eff6ff',
          border: '2px solid #3b82f6',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          marginTop: 20
        }}>
          <div style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text)' }}>
            {roleMessages[userRole] || roleMessages.sales}
          </div>
        </div>
      </div>

      {/* İnsan vs AI İş Bölümü */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="pax-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#3b82f6' }}>
            👤 İNSAN TARAFI (SEN)
          </div>
          <ul style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-2)', listStyle: 'none', paddingLeft: 0 }}>
            <li>• Stratejik kararlar</li>
            <li>• Müşteri ilişkileri</li>
            <li>• Yaratıcı problem çözme</li>
            <li>• Kritik görüşmeler</li>
            <li>• Final onaylar</li>
          </ul>
        </div>

        <div className="pax-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#a855f7' }}>
            🤖 AI TARAFI (AGENTLAR)
          </div>
          <ul style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-2)', listStyle: 'none', paddingLeft: 0 }}>
            <li>• Rutin takip işleri</li>
            <li>• Veri toplama & analiz</li>
            <li>• Otomatik raporlama</li>
            <li>• Hatırlatıcılar</li>
            <li>• İçerik taslaklarını hazırlama</li>
          </ul>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onComplete} className="pax-btn pax-btn-primary">
          Anladım, Devam Et →
        </button>
      </div>
    </div>
  );
}
