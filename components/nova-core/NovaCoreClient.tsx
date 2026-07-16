'use client';

import { useState, useEffect } from 'react';
import { 
  AI_PROGRAMS, 
  getUserTeam, 
  getUserAgents, 
  getRoleLabel,
  getRoleNode,
  getAgentsByCategory,
  getAgentCount,
  HUB_NODES,
  type UserRole 
} from '@/lib/nova-core-data';

import NovaVisionTab from './tabs/NovaVisionTab';
import NovaCurrentStructureTab from './tabs/NovaCurrentStructureTab';
import NovaAIProgramsTab from './tabs/NovaAIProgramsTab';
import NovaAIAgentsTab from './tabs/NovaAIAgentsTab';
import NovaHybridModelTab from './tabs/NovaHybridModelTab';
import NovaSalesProcessTab from './tabs/NovaSalesProcessTab';

type NovaCoreProps = {
  userRole: UserRole;
  userName: string;
  userEmail?: string;
};

type TabId = 1 | 2 | 3 | 4 | 5 | 6;

export default function NovaCoreClient({ userRole, userName, userEmail }: NovaCoreProps) {
  const [activeTab, setActiveTab] = useState<TabId>(1);
  const [completedTabs, setCompletedTabs] = useState<TabId[]>([]);
  const [activeNode, setActiveNode] = useState<string>(getRoleNode(userRole));

  // Kullanıcıya özel data
  const userTeam = getUserTeam(userRole);
  const userAgents = getUserAgents(userRole);
  const agentsByCategory = getAgentsByCategory(userRole);
  const agentStats = getAgentCount(userRole);
  const roleLabel = getRoleLabel(userRole);
  const userNode = HUB_NODES.find(n => n.id === getRoleNode(userRole));

  // İlerleme yüzdesi
  const progressPercent = Math.round((completedTabs.length / 6) * 100);

  // Tab tamamlama
  const markTabComplete = (tabId: TabId) => {
    if (!completedTabs.includes(tabId)) {
      setCompletedTabs(prev => [...prev, tabId]);
      // TODO: Backend'e kaydet
    }
  };

  // Tab değişimi
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero - Kişiselleştirilmiş */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">
          Nova Core · {userName} için Kişisel Onboarding
        </span>
        <h1 className="pax-hero-title">
          Merhaba {userName.split(' ')[0]} 👋 Sen {roleLabel} ekibindesin
        </h1>
        <p className="pax-hero-description">
          İşte senin için hazırladığımız yol haritası. Her tab’i tamamladıkça ilerleme kaydedilir.
          {userTeam.length > 0 && ` ${roleLabel} ekibinde ${userTeam.length} kişisiniz.`}
          {agentStats.active > 0 && ` Sana ${agentStats.active} AI agent yardımcı oluyor.`}
        </p>

        {/* Progress + Stats */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, opacity: 0.9 }}>
              <span>Onboarding İlerleme</span>
              <strong>{completedTabs.length}/6 Tab</strong>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPercent}%`, background: '#10b981', borderRadius: 999, transition: 'width 300ms' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="pax-hero-stat" style={{ textAlign: 'center', minWidth: 70 }}>
              <div className="pax-hero-stat-label">Ekip</div>
              <div className="pax-hero-stat-value" style={{ fontSize: 22 }}>{userTeam.length}</div>
            </div>
            <div className="pax-hero-stat" style={{ textAlign: 'center', minWidth: 70 }}>
              <div className="pax-hero-stat-label">Agent</div>
              <div className="pax-hero-stat-value" style={{ fontSize: 22 }}>{agentStats.active}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Sticky */}
      <div className="pax-card" style={{ 
        position: 'sticky', 
        top: 20, 
        zIndex: 10,
        padding: 16
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 8 
        }}>
          {([1, 2, 3, 4, 5, 6] as TabId[]).map(tabId => {
            const isActive = activeTab === tabId;
            const isCompleted = completedTabs.includes(tabId);
            const tabLabels: Record<TabId, string> = {
              1: '1. Vizyon',
              2: '2. Mevcut Yapı',
              3: '3. AI Programlar',
              4: '4. AI Agentlar',
              5: '5. Hibrit Model',
              6: '6. Kazanım'
            };

            return (
              <button
                key={tabId}
                onClick={() => handleTabChange(tabId)}
                className={`pax-btn ${isActive ? 'pax-btn-primary' : 'pax-btn-secondary'}`}
                style={{ 
                  fontSize: 13,
                  position: 'relative',
                  justifyContent: 'flex-start',
                  paddingLeft: isCompleted ? 36 : 14
                }}
              >
                {isCompleted && (
                  <span style={{ 
                    position: 'absolute',
                    left: 12,
                    fontSize: 16
                  }}>✓</span>
                )}
                {tabLabels[tabId]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 1 && (
        <NovaVisionTab onComplete={() => markTabComplete(1)} />
      )}

      {activeTab === 2 && (
        <NovaCurrentStructureTab 
          userRole={userRole}
          userTeam={userTeam}
          userNode={userNode}
          activeNode={activeNode}
          onNodeClick={setActiveNode}
          onComplete={() => markTabComplete(2)}
        />
      )}

      {activeTab === 3 && (
        <NovaAIProgramsTab onComplete={() => markTabComplete(3)} />
      )}

      {activeTab === 4 && (
        <NovaAIAgentsTab 
          userRole={userRole}
          agents={userAgents}
          agentsByCategory={agentsByCategory}
          stats={agentStats}
          onComplete={() => markTabComplete(4)}
        />
      )}

      {activeTab === 5 && (
        <NovaHybridModelTab 
          userRole={userRole}
          onComplete={() => markTabComplete(5)}
        />
      )}

      {activeTab === 6 && (
        <NovaSalesProcessTab onComplete={() => markTabComplete(6)} />
      )}
    </div>
  );
}
