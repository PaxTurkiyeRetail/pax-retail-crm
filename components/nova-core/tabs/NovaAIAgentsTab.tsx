'use client';

import { useState } from 'react';
import { getRoleLabel } from '@/lib/nova-core-data';

export default function NovaAIAgentsTab({ userRole, agents, agentsByCategory, stats, onComplete }: any) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    Object.keys(agentsByCategory)[0] || ''
  );

  const categories = Object.keys(agentsByCategory);
  const displayAgents = selectedCategory ? agentsByCategory[selectedCategory] : [];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="pax-card">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.1fr 0.9fr', 
          gap: 24,
          alignItems: 'start'
        }}>
          <div>
            <div className="pax-label" style={{ marginBottom: 12 }}>4. AI AGENTLAR</div>
            <h2 style={{ 
              fontSize: 32, 
              fontWeight: 800, 
              lineHeight: 1.2,
              marginBottom: 16,
              color: 'var(--text)'
            }}>
              Sen {getRoleLabel(userRole)} ekibindesin -{' '}
              <span style={{ color: '#a855f7' }}>İşte SENIN kullanacağın {stats.active} AI agent</span>
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>
              Toplam 52 AI agent var ama sen sadece kendi rolüne uygun olanları göreceksin. 
              Bu sayede kafan karışmaz ve hangi agentı ne zaman kullanacağını bilirsin.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ 
              background: 'var(--surface-2)', 
              borderRadius: 'var(--radius-md)', 
              padding: 16,
              textAlign: 'center'
            }}>
              <div className="pax-label" style={{ marginBottom: 8 }}>Aktif</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>{stats.active}</div>
            </div>
            <div style={{ 
              background: 'var(--surface-2)', 
              borderRadius: 'var(--radius-md)', 
              padding: 16,
              textAlign: 'center'
            }}>
              <div className="pax-label" style={{ marginBottom: 8 }}>Planlanan</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>{stats.planned}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`pax-btn ${selectedCategory === cat ? 'pax-btn-primary' : 'pax-btn-secondary'}`}
            style={{ fontSize: 13 }}
          >
            {cat} ({agentsByCategory[cat].length})
          </button>
        ))}
      </div>

      {/* Agents Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {displayAgents.map((agent: any) => {
          const statusColor = 
            agent.status === 'active' ? '#10b981' :
            agent.status === 'testing' ? '#f59e0b' :
            '#94a3b8';

          const statusLabel =
            agent.status === 'active' ? 'Aktif' :
            agent.status === 'testing' ? 'Test' :
            'Planlı';

          return (
            <div key={agent.id} className="pax-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {agent.name}
                </div>
                <span style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: `${statusColor}20`,
                  color: statusColor,
                  border: `1px solid ${statusColor}40`,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em'
                }}>
                  {statusLabel}
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-3)' }}>
                {agent.description}
              </p>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onComplete} className="pax-btn pax-btn-primary">
          Anladım, Devam Et →
        </button>
      </div>
    </div>
  );
}
