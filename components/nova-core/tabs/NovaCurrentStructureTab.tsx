'use client';

import { HUB_NODES, getRoleLabel } from '@/lib/nova-core-data';

export default function NovaCurrentStructureTab({ userRole, userTeam, userNode, activeNode, onNodeClick, onComplete }: any) {
  const currentNodeData = HUB_NODES.find(n => n.id === activeNode);

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
            <div className="pax-label" style={{ marginBottom: 12 }}>2. MEVCUT YAPI</div>
            <h2 style={{ 
              fontSize: 32, 
              fontWeight: 800, 
              lineHeight: 1.2,
              marginBottom: 16,
              color: 'var(--text)'
            }}>
              Bugünkü yapı,{' '}
              <span style={{ color: '#3b82f6' }}>küçük ama çapraz rolleri güçlü</span>
              {' '}bir ekip ile büyük operasyonu taşıyor.
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 16 }}>
              Mevcut organizasyonda her bir kişi çoğu zaman birden fazla alana dokunuyor. 
              Bu da aynı anda esneklik ve yük oluşturuyor.
            </p>

            {/* Kullanıcının ekibi vurgulanmış */}
            {userTeam.length > 0 && (
              <div style={{ 
                background: 'var(--chip-indigo-bg)',
                border: '2px solid #3b82f6',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                marginTop: 16
              }}>
                <div style={{ 
                  fontSize: 13, 
                  fontWeight: 700, 
                  color: '#1e40af',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ fontSize: 18 }}>👉</span>
                  SEN BURADASIN
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  {getRoleLabel(userRole)} Ekibi
                </div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  {userTeam.map((member: { name: string; title: string }) => (
                    <div key={member.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{member.name}</span>
                      <span style={{ color: 'var(--text-3)' }}>{member.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="nova-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ 
              background: 'var(--surface-2)', 
              borderRadius: 'var(--radius-md)', 
              padding: 16,
              textAlign: 'center'
            }}>
              <div className="pax-label" style={{ marginBottom: 8 }}>Satış</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>2+1</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Stajyer destekli</div>
            </div>
            <div style={{ 
              background: 'var(--surface-2)', 
              borderRadius: 'var(--radius-md)', 
              padding: 16,
              textAlign: 'center'
            }}>
              <div className="pax-label" style={{ marginBottom: 8 }}>Support</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>2</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Teknik omurga</div>
            </div>
            <div style={{ 
              background: 'var(--surface-2)', 
              borderRadius: 'var(--radius-md)', 
              padding: 16,
              textAlign: 'center'
            }}>
              <div className="pax-label" style={{ marginBottom: 8 }}>Pazarlama</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>1+1</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>AI destekli üretim</div>
            </div>
            <div style={{ 
              background: 'var(--surface-2)', 
              borderRadius: 'var(--radius-md)', 
              padding: 16,
              textAlign: 'center'
            }}>
              <div className="pax-label" style={{ marginBottom: 8 }}>PMO / AI</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>1+1</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Takip ve otomasyon</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Hub */}
      <div className="pax-card">
        <div className="nova-responsive-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.05fr 0.95fr', 
          gap: 24,
          alignItems: 'start'
        }}>
          {/* Hub Visual */}
          <div style={{ 
            position: 'relative',
            aspectRatio: '1/1',
            maxWidth: 560,
            margin: '0 auto',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            background: 'radial-gradient(circle at center, rgba(255,255,255,0.98) 0%, var(--surface-2) 100%)'
          }}>
            {/* Merkez */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--text), #4338ca)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(67, 56, 202, 0.3)',
              boxShadow: '0 20px 50px rgba(15,23,42,0.3)'
            }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>PAX</div>
              <div style={{ fontSize: 10, letterSpacing: '.3em', opacity: 0.8 }}>RETAIL</div>
            </div>

            {/* Nodes */}
            {HUB_NODES.map((node, idx) => {
              const angle = (idx * 60) * (Math.PI / 180);
              const radius = 200;
              const x = 50 + radius * Math.cos(angle - Math.PI / 2);
              const y = 50 + radius * Math.sin(angle - Math.PI / 2);
              const isActive = activeNode === node.id;
              const isUserNode = userNode?.id === node.id;

              const colorMap: Record<string, string> = {
                emerald: isActive ? '#10b981' : '#86efac',
                violet: isActive ? '#a855f7' : '#c4b5fd',
                sky: isActive ? '#0ea5e9' : '#7dd3fc',
                pink: isActive ? '#ec4899' : '#f9a8d4',
                orange: isActive ? '#f97316' : '#fdba74',
                cyan: isActive ? '#06b6d4' : '#67e8f9'
              };

              return (
                <button
                  key={node.id}
                  onClick={() => onNodeClick(node.id)}
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isActive ? 120 : 100,
                    height: isActive ? 120 : 100,
                    borderRadius: '50%',
                    border: isUserNode ? '3px solid #3b82f6' : '2px solid var(--border)',
                    background: isActive ? colorMap[node.color] : '#fff',
                    color: isActive ? '#fff' : 'var(--text)',
                    fontSize: isActive ? 13 : 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: 12,
                    cursor: 'pointer',
                    transition: 'all 200ms',
                    boxShadow: isActive ? '0 20px 40px rgba(0,0,0,0.2)' : '0 8px 20px rgba(0,0,0,0.1)',
                    lineHeight: 1.2
                  }}
                >
                  {isUserNode && (
                    <span style={{ 
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      fontSize: 20
                    }}>
                      👤
                    </span>
                  )}
                  {node.label}
                </button>
              );
            })}
          </div>

          {/* Detail Panel */}
          {currentNodeData && (
            <div>
              <div style={{ 
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                borderLeft: `4px solid ${
                  currentNodeData.color === 'emerald' ? '#10b981' :
                  currentNodeData.color === 'violet' ? '#a855f7' :
                  currentNodeData.color === 'sky' ? '#0ea5e9' :
                  currentNodeData.color === 'pink' ? '#ec4899' :
                  currentNodeData.color === 'orange' ? '#f97316' :
                  '#06b6d4'
                }`
              }}>
                <div className="pax-label" style={{ marginBottom: 12 }}>
                  {currentNodeData.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                  {currentNodeData.description}
                </div>

                {/* Ekip */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)' }}>
                    Ekip Üyeleri:
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    {currentNodeData.team.join(' · ')}
                  </div>
                </div>

                {/* Sorumluluklar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)' }}>
                    Sorumluluklar:
                  </div>
                  <ul style={{ 
                    display: 'grid', 
                    gap: 6, 
                    fontSize: 13, 
                    color: 'var(--text-3)',
                    listStyle: 'none',
                    paddingLeft: 0
                  }}>
                    {currentNodeData.responsibilities.map((resp, i) => (
                      <li key={i}>• {resp}</li>
                    ))}
                  </ul>
                </div>

                {/* Bağlı Sistemler */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)' }}>
                    Bağlı Sistemler:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {currentNodeData.connectedSystems.map((system, i) => (
                      <span 
                        key={i}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-2)',
                          fontWeight: 600
                        }}
                      >
                        {system}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
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
