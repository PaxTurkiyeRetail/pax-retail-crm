'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

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
  missingForecastFirms: string[];
  missingBlockerFirms: string[];
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
  const [openDetail, setOpenDetail] = useState<string | null>(null);

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
              <th style={{ padding: '10px 14px' }} title="Hunter firma sayısı (soldaki H) ile karşılaştır: her Hunter'ın Forecast ve Engel&Etki girişi olmalı">Forecast → E&amp;E</th>
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
            ) : sortedRows.map((row) => {
              const hasMissing = row.missingForecastFirms.length > 0 || row.missingBlockerFirms.length > 0;
              const isOpen = openDetail === row.owner;
              return (
              <Fragment key={row.owner}>
                <tr style={{ borderBottom: '1px solid var(--border-1, #f1f5f9)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.owner}</td>
                <td style={{ padding: '10px 14px' }}>
                  {row.visitsYear.actual}{row.visitsYear.target != null ? ` / ${row.visitsYear.target}` : ''}
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: pctColor(row.visitsYear.pct) }}>
                  {row.visitsYear.pct != null ? `%${row.visitsYear.pct}` : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>{row.portfolio.total}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(37,99,235,0.15)', color: '#1d4ed8' }} title="Hunter">
                      {row.portfolio.hunter}
                    </span>
                    <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(22,163,74,0.15)', color: '#15803d' }} title="Farmer">
                      {row.portfolio.farmer}
                    </span>
                    <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(202,138,4,0.15)', color: '#a16207' }} title="Kasa">
                      {row.portfolio.kasa}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    type="button"
                    disabled={!hasMissing}
                    onClick={() => setOpenDetail(isOpen ? null : row.owner)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: hasMissing ? 'pointer' : 'default',
                      textDecoration: hasMissing ? 'underline' : 'none',
                      font: 'inherit',
                    }}
                    title={hasMissing ? 'Eksik firmaları görmek için tıkla' : ''}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: row.forecastFirms < row.portfolio.hunter ? 'rgba(220,38,38,0.15)' : 'rgba(21,128,61,0.15)', color: row.forecastFirms < row.portfolio.hunter ? '#dc2626' : '#15803d' }}>
                        {row.forecastFirms}
                      </span>
                      <span style={{ color: 'var(--text-3)' }}>→</span>
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: row.blockerFirms < row.portfolio.hunter ? 'rgba(220,38,38,0.15)' : 'rgba(21,128,61,0.15)', color: row.blockerFirms < row.portfolio.hunter ? '#dc2626' : '#15803d' }}>
                        {row.blockerFirms}
                      </span>
                    </div>
                  </button>
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
                {isOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={9} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ color: '#dc2626' }}>Forecast eksik ({row.missingForecastFirms.length}):</strong>
                          <div style={{ marginTop: 4 }}>
                            {row.missingForecastFirms.length === 0 ? 'Yok' : row.missingForecastFirms.join(', ')}
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: '#dc2626' }}>Engel&amp;Etki eksik ({row.missingBlockerFirms.length}):</strong>
                          <div style={{ marginTop: 4 }}>
                            {row.missingBlockerFirms.length === 0 ? 'Yok' : row.missingBlockerFirms.join(', ')}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
