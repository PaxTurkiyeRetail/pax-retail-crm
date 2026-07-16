'use client';

import { useEffect } from 'react';

export default function NovaVisionTab({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    // 30 saniye sonra otomatik tamamla (sayfa okunduysa)
    const timer = setTimeout(onComplete, 30000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="pax-card">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.15fr 0.85fr', 
          gap: 24,
          alignItems: 'start'
        }}>
          <div>
            <div className="pax-label" style={{ marginBottom: 12 }}>1. VİZYON</div>
            <h2 style={{ 
              fontSize: 32, 
              fontWeight: 800, 
              lineHeight: 1.2,
              marginBottom: 16,
              color: 'var(--text)'
            }}>
              Biz burada yalnızca birkaç AI aracı kullanmayı değil,{' '}
              <span style={{ color: '#10b981' }}>PAX Retail için yeni bir çalışma modeli</span>
              {' '}kurmayı amaçlıyoruz.
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
              Amaç; sınırlı insan kaynağı ile daha büyük satış kapasitesi üretmek, 
              günlük operasyonu daha görünür hale getirmek, tekrar eden işleri AI ile 
              disipline etmek ve yönetim katmanında daha net karar alabilmektir. 
              Bu nedenle yaklaşımımız araç bazlı değil, işletim modeli bazlıdır.
            </p>
          </div>

          <div style={{ 
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            color: '#fff',
            borderRadius: 'var(--radius-lg)',
            padding: 20
          }}>
            <div style={{ 
              fontSize: 11, 
              textTransform: 'uppercase', 
              letterSpacing: '.16em',
              opacity: 0.7,
              marginBottom: 12
            }}>
              Ana Karar Cümlesi
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
              PAX Retail’in bir sonraki büyüme eşiği, insan ekibin yanına kontrollü 
              çalışan bir AI organizasyon katmanı eklemektir.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="pax-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>Neyi Çözüyoruz</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
            Kaynak Baskısı
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-3)' }}>
            Az kişiyle çok fazla müşteri, teklif, entegrasyon, destek ve koordinasyon yükü yönetiliyor.
          </p>
        </div>

        <div className="pax-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>Neyi Kuruyoruz</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
            AI Destekli İş Gücü
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-3)' }}>
            Satış, support, pazarlama, PMO ve yönetim için rol bazlı çalışan agent setleri kuruyoruz.
          </p>
        </div>

        <div className="pax-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <div className="pax-label" style={{ marginBottom: 8 }}>Neyi Hedefliyoruz</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
            Yönetilebilir Büyüme
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-3)' }}>
            Daha görünür pipeline, daha disiplinli operasyon, daha güçlü forecast ve daha net yönetim görünürlüğü.
          </p>
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

// TAB 2, 3, 4, 5, 6 komponentleri devam edecek...
// (Şimdi sadece placeholder'ları ekleyeceğim, sonra doldururuz)
