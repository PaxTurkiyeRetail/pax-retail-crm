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
        <div className="tw-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`tw-tab${tab === item.key ? ' tw-tab-active' : ''}`}
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
