'use client';

import { AI_PROGRAMS } from '@/lib/nova-core-data';

export default function NovaAIProgramsTab({ onComplete }: any) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="pax-card">
        <div className="nova-responsive-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.1fr 0.9fr', 
          gap: 24,
          alignItems: 'start'
        }}>
          <div>
            <div className="pax-label" style={{ marginBottom: 12 }}>3. AI PROGRAMLAR</div>
            <h2 style={{ 
              fontSize: 32, 
              fontWeight: 800, 
              lineHeight: 1.2,
              marginBottom: 16,
              color: 'var(--text)'
            }}>
              Burada tek bir AI yok.{' '}
              <span style={{ color: '#6366f1' }}>Birbirini tamamlayan katmanlı bir AI ekosistemi</span>
              {' '}var.
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
              Core LLM tarafı düşünür, agent mantığı karar verir, otomasyon katmanı işi yürütür, 
              kurumsal AI günlük operasyonu destekler, kreatif AI içerik üretir, development AI ise 
              ürün ve yazılım geliştirmeyi hızlandırır.
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
              Özet
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
              Tek bir araç değil, birlikte çalışan bütünsel bir AI organizasyonu kuruyoruz.
            </div>
          </div>
        </div>
      </div>

      {/* AI Programs Grid */}
      <div className="nova-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {AI_PROGRAMS.map(program => (
          <div key={program.id} className="pax-card">
            <div className="pax-label" style={{ marginBottom: 8 }}>{program.name}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
              {program.description}
            </div>
            <div style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--text-3)' }}>
              {program.tools.map((tool, i) => (
                <div key={i}>• {tool}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onComplete} className="pax-btn pax-btn-primary">
          Anladım, Devam Et →
        </button>
      </div>
    </div>
  );
}
