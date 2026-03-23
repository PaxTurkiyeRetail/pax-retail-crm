'use client';

import { useEffect, useState } from 'react';
import { isAdminLike } from '@/lib/roles';
import RequestsClient from './RequestsClient';
import NewRequestForm from './NewRequestForm';
import RequestsDashboard from './RequestsDashboard';
import PersonStats from './PersonStats';

type Tab = 'list' | 'dashboard' | 'people' | 'new';

// Sol taraftaki sekmeler (normal nav)
const LEFT_TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: 'list',      label: 'Talepler' },
  { id: 'dashboard', label: 'Dashboard', adminOnly: true },
  { id: 'people',    label: 'Kişiler' },
];

export default function RequestsHub({ userRole, userId }: { userRole: string; userId: string }) {
  const isAdmin = isAdminLike(userRole);
  const [active, setActive] = useState<Tab>('list');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab;
    if (['list','dashboard','people','new'].includes(hash)) setActive(hash);
  }, []);

  const go = (tab: Tab) => {
    setActive(tab);
    window.history.replaceState(null, '', `#${tab}`);
  };

  const visibleLeft = LEFT_TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="req-hub">
      <style jsx>{`
        .req-hub { display: grid; gap: 16px; }

        /* ── Tab bar ── */
        .tab-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 4px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 16px;
        }
        .tab-left {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          scrollbar-width: none;
          flex: 1;
        }
        .tab-left::-webkit-scrollbar { display: none; }

        .tab-btn {
          flex-shrink: 0;
          padding: 9px 18px;
          border-radius: 12px;
          border: none;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background .15s, color .15s, box-shadow .15s;
          background: transparent;
          color: var(--text-3);
          white-space: nowrap;
        }
        .tab-btn.active {
          background: var(--surface);
          color: var(--text);
          box-shadow: 0 1px 4px rgba(0,0,0,.08);
        }

        /* + Yeni Talep — sağ tarafta, her zaman görünür */
        .new-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 16px;
          margin-right: 2px;
          border-radius: 12px;
          border: none;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity .15s;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: #fff;
        }
        .new-btn.active {
          opacity: .85;
          box-shadow: 0 0 0 2px #93c5fd;
        }

        @media (max-width: 640px) {
          .tab-btn  { padding: 8px 12px; font-size: 12px; }
          .new-btn  { padding: 8px 12px; font-size: 12px; }
        }
        @media (max-width: 400px) {
          /* Very small: hide label on left tabs, show only on active */
          .tab-btn:not(.active) { padding: 8px 10px; font-size: 11px; }
        }
      `}</style>

      {/* Hero */}
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Request Intelligence</span>
        <h1 className="pax-hero-title">Talepler</h1>
        <p className="pax-hero-description">Kim kimden ne istedi, ne zaman, hangi durumda — tek ekranda.</p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {/* Sol: navigasyon tab'ları */}
        <div className="tab-left">
          {visibleLeft.map(t => (
            <button
              key={t.id}
              className={`tab-btn${active === t.id ? ' active' : ''}`}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sağ: Yeni Talep aksiyonu */}
        <button
          className={`new-btn${active === 'new' ? ' active' : ''}`}
          onClick={() => go('new')}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span>Yeni Talep</span>
        </button>
      </div>

      {/* İçerik */}
      <div>
        {active === 'list'      && <RequestsClient  userRole={userRole} userId={userId} onNewRequest={() => go('new')} />}
        {active === 'new'       && <NewRequestForm  userRole={userRole} onCreated={() => go('list')} />}
        {active === 'dashboard' && <RequestsDashboard />}
        {active === 'people'    && <PersonStats />}
      </div>
    </div>
  );
}
