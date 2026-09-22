'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Row = {
  owner: string;
  initials: string;
  visitsYear: { actual: number; target: number | null; pct: number | null };
  portfolio: { total: number; active: number; farmer: number; hunter: number; kasa: number };
  coverage: {
    coveredCustomers: number;
    contactsPer: { actual: number; target: number | null; pct: number | null };
    activitiesYear: number;
  };
  inactive: { count: number; days: number; unmatched: number };
  forecastFirms: number;
  blockerFirms: number;
};

type Payload = { generatedAt: string; rows: Row[] };

const EMPTY: Payload = { generatedAt: '', rows: [] };

function pctColor(pct: number | null) {
  if (pct == null) return 'var(--text-3)';
  if (pct >= 100) return '#15803d';
  if (pct >= 60) return '#b45309';
  return '#dc2626';
}

export default function YilZiyaretPortfoyClient() {
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reports/yil-ziyaret-portfoy', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Rapor yüklenemedi.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sortedRows = useMemo(
    () => [...data.rows].sort((a, b) => (b.visitsYear.pct ?? -1) - (a.visitsYear.pct ?? -1)),
    [data.rows],
  );

  return (
    <main className="pax-page-container">
      <div className="pax-card" style={{ padding: 20, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Yıl Ziyaret &amp; Portföy Sağlığı Raporu</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
          Tüm satışçıların yıl içi ziyaret hedefi ve portföy sağlığı (hareketsiz firma, temas edilen müşteri, ortalama temas) tek tabloda.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{data.rows.length} satışçı</span>
        </div>
      </div>

      {error && (
        <div className="pax-card" style={{ padding: 16, marginBottom: 16, color: '#dc2626' }}>{error}</div>
      )}

      <div className="pax-card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-1, #e5e7eb)' }}>
              <th style={{ padding: '10px 14px' }}>Satışçı</th>
              <th style={{ padding: '10px 14px' }}>Yıl Ziyaret</th>
              <th style={{ padding: '10px 14px' }}>%</th>
              <th style={{ padding: '10px 14px' }}>Portföy</th>
              <th style={{ padding: '10px 14px' }}>H / F / K</th>
              <th style={{ padding: '10px 14px' }} title="Hunter firma sayısı ile karşılaştır: her Hunter'ın Forecast ve Engel&Etki girişi olmalı">Hunter → Forecast → E&amp;E</th>
              <th style={{ padding: '10px 14px' }}>Hareketsiz Firma</th>
              <th style={{ padding: '10px 14px' }}>Temas Edilen Müşteri</th>
              <th style={{ padding: '10px 14px' }}>Ort. Temas / Firma</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor…</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Kayıt yok.</td></tr>
            ) : sortedRows.map((row) => (
              <tr key={row.owner} style={{ borderBottom: '1px solid var(--border-1, #f1f5f9)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.owner}</td>
                <td style={{ padding: '10px 14px' }}>
                  {row.visitsYear.actual}{row.visitsYear.target != null ? ` / ${row.visitsYear.target}` : ''}
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: pctColor(row.visitsYear.pct) }}>
                  {row.visitsYear.pct != null ? `%${row.visitsYear.pct}` : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>{row.portfolio.total}</td>
                <td style={{ padding: '10px 14px' }}>{row.portfolio.hunter} / {row.portfolio.farmer} / {row.portfolio.kasa}</td>
                <td style={{ padding: '10px 14px' }}>
                  {row.portfolio.hunter}
                  {' → '}
                  <span style={{ color: row.forecastFirms < row.portfolio.hunter ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                    {row.forecastFirms}
                  </span>
                  {' → '}
                  <span style={{ color: row.blockerFirms < row.portfolio.hunter ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                    {row.blockerFirms}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: row.inactive.count > 0 ? '#dc2626' : undefined, fontWeight: row.inactive.count > 0 ? 700 : 400 }}>
                  {row.inactive.count}
                </td>
                <td style={{ padding: '10px 14px' }}>{row.coverage.coveredCustomers}</td>
                <td style={{ padding: '10px 14px' }}>
                  {row.coverage.contactsPer.actual}
                  {row.coverage.contactsPer.target != null ? ` / ${row.coverage.contactsPer.target}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
