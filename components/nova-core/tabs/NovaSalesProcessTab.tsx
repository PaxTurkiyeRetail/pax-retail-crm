'use client';

export default function NovaSalesProcessTab({ onComplete }: any) {
  const stages = [
    { id: 1, name: 'Lead', color: '#10b981', description: 'İlk temas ve fırsat tespiti' },
    { id: 2, name: 'Opportunity', color: '#3b82f6', description: 'İhtiyaç analizi ve teklif hazırlığı' },
    { id: 3, name: 'Proposal', color: '#f59e0b', description: 'Teklif sunumu ve müzakere' },
    { id: 4, name: 'Pilot', color: '#a855f7', description: 'Pilot çalışma ve test' },
    { id: 5, name: 'Rollout', color: '#ec4899', description: 'Canlıya geçiş ve yaygınlaştırma' },
    { id: 6, name: 'Live', color: '#06b6d4', description: 'Aktif müşteri yönetimi' }
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="pax-card">
        <div className="pax-label" style={{ marginBottom: 12 }}>6. SATIŞ SÜRECİ</div>
        <h2 style={{ 
          fontSize: 32, 
          fontWeight: 800, 
          lineHeight: 1.2,
          marginBottom: 16,
          color: 'var(--text)'
        }}>
          Müşteri Kazanım Yolculuğu
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
          Her müşteri bu 6 aşamadan geçer. Sen hangi aşamada olduğunu CRM'den takip edeceksin.
        </p>
      </div>

      {/* Stages */}
      <div style={{ display: 'grid', gap: 16 }}>
        {stages.map((stage, idx) => (
          <div key={stage.id} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ 
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: stage.color,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              flexShrink: 0
            }}>
              {stage.id}
            </div>

            <div className="pax-card" style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                {stage.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {stage.description}
              </div>
            </div>

            {idx < stages.length - 1 && (
              <div style={{ 
                fontSize: 24, 
                color: 'var(--text-4)',
                flexShrink: 0
              }}>
                →
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pax-card" style={{ 
        background: '#ecfdf5',
        border: '2px solid #10b981',
        textAlign: 'center',
        padding: 24
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#059669', marginBottom: 8 }}>
          🎉 Tebrikler! Nova Core Onboarding'i Tamamladın
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Artık PAX Retail'in AI destekli çalışma sistemini biliyorsun. CRM'de işine başlayabilirsin!
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onComplete} className="pax-btn pax-btn-primary">
          ✓ Tamamladım
        </button>
      </div>
    </div>
  );
}
