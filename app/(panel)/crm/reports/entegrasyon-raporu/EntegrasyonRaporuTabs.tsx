'use client';

import { useState } from 'react';
import EntegrasyonRaporuClient from './EntegrasyonRaporuClient';
import KasaposEntegrasyonClient from './KasaposEntegrasyonClient';

// Entegrasyon Raporu sekmeleri: firma faz durumu + KasaPOS adet & tutar (müdür raporu, 02.10.2026).
const TABS = [
  { key: 'durum', label: 'Firma Durumu' },
  { key: 'adet-tutar', label: 'KasaPOS Adet & Tutar' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function EntegrasyonRaporuTabs() {
  const [tab, setTab] = useState<TabKey>('durum');

  return (
    <>
      <div className="pax-page-container no-print" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-1, #ccc)',
                background: tab === item.key ? '#1F4E79' : 'transparent',
                color: tab === item.key ? '#fff' : 'inherit',
                fontWeight: tab === item.key ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'durum' ? <EntegrasyonRaporuClient /> : <KasaposEntegrasyonClient />}
    </>
  );
}
