'use client';

import type { CSSProperties } from 'react';
import '@/styles/customers-hero.css';

type SummaryItem = { label: string; value: number };
type StatsPayload = {
  total: number; sectors: number; kasaFirmasi: number; accounts: number;
  kunyeVar: number; kunyeYok: number; kunyeEksik: number; entegrasyonYapisi: number;
  byPhase: SummaryItem[]; byOwner: SummaryItem[]; bySector: SummaryItem[];
};
type BarItem = { label: string; value: number };

type Props = {
  stats: StatsPayload;
  completionRate: number;
  kunyeDonutStyle: CSSProperties;
  kasaDonutStyle: CSSProperties;
  accountDonutStyle: CSSProperties;
  kasaBreakdown: BarItem[];
  topSectors: BarItem[];
  sectorMax: number;
  visibleOwnerBars: BarItem[];
  fieldOwnerMax: number;
  fieldAccountCount: number;
};

const _svg = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function Building2({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/></svg>; }
function Layers3({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg}><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>; }
function Users({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" {..._svg}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }

export default function CustomersHero({
  stats, completionRate,
  kunyeDonutStyle, kasaDonutStyle, accountDonutStyle,
  kasaBreakdown, topSectors, sectorMax,
  visibleOwnerBars, fieldOwnerMax, fieldAccountCount,
}: Props) {
  const havuzOwner = visibleOwnerBars.find(b => b.label === 'Havuz Account');

  return (
    <>
      {/* ── Kompakt Hero ── */}
      <section className="pax-hero">
        <span className="pax-hero-eyebrow">Müşteri Portföyü</span>
        <h1 className="pax-hero-title">Müşteriler</h1>
        <p className="pax-hero-description">Portföy kalitesi, künye doluluk oranı, sektör dağılımı ve sahiplik özeti.</p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Toplam Müşteri</div>
            <div className="pax-hero-stat-value">{stats.total}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Künye Tamam</div>
            <div className="pax-hero-stat-value">{stats.kunyeVar}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Künye Oranı</div>
            <div className="pax-hero-stat-value">%{completionRate}</div>
          </div>
          <div className="pax-hero-stat">
            <div className="pax-hero-stat-label">Sektör</div>
            <div className="pax-hero-stat-value">{stats.sectors}</div>
          </div>
        </div>
      </section>

      {/* ── Detay Kartları (beyaz arka plan) ── */}
      <div className="ch-detail-grid">

        {/* Kart 1: Müşteri Durumu */}
        <div className="ch-card">
          <div className="ch-card-head">
            <div>
              <div className="ch-kicker">Müşteri Durumu</div>
              <div className="ch-big">{stats.total}</div>
              <div className="ch-sub">Toplam portföy ve künye kalitesi tek bakışta.</div>
            </div>
            <Building2 size={18} />
          </div>
          <div className="ch-split-stats">
            <div className="ch-split-row">
              <span className="ch-dot" style={{ background: '#22c55e' }} />
              <span>Tamam</span>
              <strong>{stats.kunyeVar}</strong>
            </div>
            <div className="ch-split-row">
              <span className="ch-dot" style={{ background: '#f59e0b' }} />
              <span>Eksik</span>
              <strong>{stats.kunyeEksik}</strong>
            </div>
            <div className="ch-split-row">
              <span className="ch-dot" style={{ background: '#94a3b8' }} />
              <span>Yok</span>
              <strong>{stats.kunyeYok}</strong>
            </div>
          </div>
          <div className="ch-donut-row">
            <div className="ch-donut-wrap">
              <div className="ch-donut" style={kunyeDonutStyle}>
                <div className="ch-donut-center">
                  <strong>{completionRate}%</strong>
                  <span>Künye</span>
                </div>
              </div>
            </div>
            <div className="ch-donut-info">
              <div className="ch-donut-kicker">Kasa Firmaları</div>
              <div className="ch-legend">
                {kasaBreakdown.slice(0, 3).map((item, i) => {
                  const colors = ['#5eead4', '#38bdf8', '#818cf8'];
                  return (
                    <div key={item.label} className="ch-legend-row">
                      <span className="ch-dot" style={{ background: colors[i % colors.length] }} />
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Kart 2: Sektör Dağılımı */}
        <div className="ch-card">
          <div className="ch-card-head">
            <div>
              <div className="ch-kicker">Sektör Dağılımı</div>
              <div className="ch-big">{stats.sectors}</div>
              <div className="ch-sub">Portföyün hangi sektörlerde yoğunlaştığını izle.</div>
            </div>
            <Layers3 size={18} />
          </div>
          <div className="ch-bars">
            {topSectors.map((item) => (
              <div key={item.label} className="ch-bar-row">
                <span className="ch-bar-label">{item.label}</span>
                <div className="ch-bar-track">
                  <span style={{ width: `${sectorMax ? (item.value / sectorMax) * 100 : 0}%` }} />
                </div>
                <span className="ch-bar-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Kart 3: Account Yapısı */}
        <div className="ch-card">
          <div className="ch-card-head">
            <div>
              <div className="ch-kicker">Account Yapısı</div>
              <div className="ch-big">{fieldAccountCount}</div>
              <div className="ch-sub">Dağılım, yük ve öne çıkan account yapısı.</div>
            </div>
            <Users size={18} />
          </div>
          <div className="ch-owner-layout">
            <div className="ch-bars">
              {visibleOwnerBars.map((item) => (
                <div key={item.label} className="ch-bar-row">
                  <span className="ch-bar-label">{item.label}</span>
                  <div className="ch-bar-track">
                    <span style={{ width: `${fieldOwnerMax ? (item.value / fieldOwnerMax) * 100 : 0}%` }} />
                  </div>
                  <span className="ch-bar-value">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="ch-donut-wrap">
              <div className="ch-donut" style={accountDonutStyle}>
                <div className="ch-donut-center">
                  <strong>{havuzOwner?.value ?? 0}</strong>
                  <span>{havuzOwner ? 'Havuz' : 'Merkez'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
