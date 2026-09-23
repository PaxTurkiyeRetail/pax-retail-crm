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
  kunyeHealth: { tamam: number; eksik: number; yok: number };
  missingKunyeFirms: string[];
  hunterFirmNames: string[];
  farmerFirmNames: string[];
  kasaFirmNames: string[];
  bankaFirmNames: string[];
  leadFirmNames: string[];
  activeFirmNames: string[];
  coveredCustomerNames: string[];
};

type DetailKind = 'forecast' | 'kunye' | 'hunter' | 'farmer' | 'kasa' | 'banka' | 'lead' | 'total' | 'active' | 'covered';

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
  const [openDetail, setOpenDetail] = useState<{ owner: string; kind: DetailKind } | null>(null);

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
              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>H</span>
                  <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>F</span>
                  <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>K</span>
                  <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>B</span>
                  <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>L</span>
                </div>
              </th>
              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} title="Hunter firmalardan Forecast / Engel&Etki girişi EKSİK olan sayısı (0 = tamam)">
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>F</span>
                  <span>/</span>
                  <span style={{ display: 'inline-block', minWidth: 34, textAlign: 'center' }}>E&amp;E</span>
                </div>
              </th>
              <th style={{ padding: '10px 14px' }}>Hareketsiz Firma</th>
              <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} title="Künye doluluk durumu: Eksik/Yok toplamı (0 = tüm künyeler tamam)">Künye Sağlığı</th>
              <th style={{ padding: '10px 14px' }}>Temas Edilen Müşteri</th>
              <th style={{ padding: '10px 14px' }}>Ort. Temas / Firma</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor…</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Kayıt yok.</td></tr>
            ) : sortedRows.map((row) => {
              const hasMissing = row.missingForecastFirms.length > 0 || row.missingBlockerFirms.length > 0;
              const hasKunyeMissing = row.missingKunyeFirms.length > 0;
              const isForecastOpen = openDetail?.owner === row.owner && openDetail.kind === 'forecast';
              const isKunyeOpen = openDetail?.owner === row.owner && openDetail.kind === 'kunye';
              const isHunterOpen = openDetail?.owner === row.owner && openDetail.kind === 'hunter';
              const isFarmerOpen = openDetail?.owner === row.owner && openDetail.kind === 'farmer';
              const isKasaOpen = openDetail?.owner === row.owner && openDetail.kind === 'kasa';
              const isBankaOpen = openDetail?.owner === row.owner && openDetail.kind === 'banka';
              const isLeadOpen = openDetail?.owner === row.owner && openDetail.kind === 'lead';
              const isTotalOpen = openDetail?.owner === row.owner && openDetail.kind === 'total';
              const isActiveOpen = openDetail?.owner === row.owner && openDetail.kind === 'active';
              const isCoveredOpen = openDetail?.owner === row.owner && openDetail.kind === 'covered';
              const allFirmNames = [...row.hunterFirmNames, ...row.farmerFirmNames, ...row.kasaFirmNames, ...row.bankaFirmNames, ...row.leadFirmNames].sort((a, b) => a.localeCompare(b, 'tr'));
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
                <td style={{ padding: '10px 14px' }}>
                  <button
                    type="button"
                    disabled={allFirmNames.length === 0}
                    onClick={() => setOpenDetail(isTotalOpen ? null : { owner: row.owner, kind: 'total' })}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: allFirmNames.length ? 'pointer' : 'default', textDecoration: allFirmNames.length ? 'underline' : 'none', font: 'inherit' }}
                    title="Portföydeki tüm firmaları görmek için tıkla"
                  >
                    {row.portfolio.total}
                  </button>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      disabled={row.hunterFirmNames.length === 0}
                      onClick={() => setOpenDetail(isHunterOpen ? null : { owner: row.owner, kind: 'hunter' })}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: row.hunterFirmNames.length ? 'pointer' : 'default', font: 'inherit' }}
                      title="Hunter firmaları görmek için tıkla"
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(37,99,235,0.15)', color: '#1d4ed8', textDecoration: row.hunterFirmNames.length ? 'underline' : 'none' }}>
                        {row.hunterFirmNames.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={row.farmerFirmNames.length === 0}
                      onClick={() => setOpenDetail(isFarmerOpen ? null : { owner: row.owner, kind: 'farmer' })}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: row.farmerFirmNames.length ? 'pointer' : 'default', font: 'inherit' }}
                      title="Farmer firmaları görmek için tıkla"
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(22,163,74,0.15)', color: '#15803d', textDecoration: row.farmerFirmNames.length ? 'underline' : 'none' }}>
                        {row.farmerFirmNames.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={row.kasaFirmNames.length === 0}
                      onClick={() => setOpenDetail(isKasaOpen ? null : { owner: row.owner, kind: 'kasa' })}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: row.kasaFirmNames.length ? 'pointer' : 'default', font: 'inherit' }}
                      title="Kasa firmaları görmek için tıkla"
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(202,138,4,0.15)', color: '#a16207', textDecoration: row.kasaFirmNames.length ? 'underline' : 'none' }}>
                        {row.kasaFirmNames.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={row.bankaFirmNames.length === 0}
                      onClick={() => setOpenDetail(isBankaOpen ? null : { owner: row.owner, kind: 'banka' })}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: row.bankaFirmNames.length ? 'pointer' : 'default', font: 'inherit' }}
                      title="Banka/Finans firmaları görmek için tıkla"
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(124,58,237,0.15)', color: '#6d28d9', textDecoration: row.bankaFirmNames.length ? 'underline' : 'none' }}>
                        {row.bankaFirmNames.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={row.leadFirmNames.length === 0}
                      onClick={() => setOpenDetail(isLeadOpen ? null : { owner: row.owner, kind: 'lead' })}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: row.leadFirmNames.length ? 'pointer' : 'default', font: 'inherit' }}
                      title="Lead firmaları görmek için tıkla"
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(100,116,139,0.15)', color: '#475569', textDecoration: row.leadFirmNames.length ? 'underline' : 'none' }}>
                        {row.leadFirmNames.length}
                      </span>
                    </button>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    type="button"
                    disabled={!hasMissing}
                    onClick={() => setOpenDetail(isForecastOpen ? null : { owner: row.owner, kind: 'forecast' })}
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
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: row.missingForecastFirms.length > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(21,128,61,0.15)', color: row.missingForecastFirms.length > 0 ? '#dc2626' : '#15803d' }} title="Forecast eksik">
                        {row.missingForecastFirms.length}
                      </span>
                      <span style={{ color: 'var(--text-3)' }}>/</span>
                      <span style={{ display: 'inline-block', minWidth: 34, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: row.missingBlockerFirms.length > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(21,128,61,0.15)', color: row.missingBlockerFirms.length > 0 ? '#dc2626' : '#15803d' }} title="Engel&Etki eksik">
                        {row.missingBlockerFirms.length}
                      </span>
                    </div>
                  </button>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={row.activeFirmNames.length === 0}
                      onClick={() => setOpenDetail(isActiveOpen ? null : { owner: row.owner, kind: 'active' })}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: row.activeFirmNames.length ? 'pointer' : 'default', font: 'inherit' }}
                      title="Hareketli firmaları görmek için tıkla"
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(21,128,61,0.15)', color: '#15803d', textDecoration: row.activeFirmNames.length ? 'underline' : 'none' }} title="Hareketli">
                        {row.activeFirmNames.length}
                      </span>
                    </button>
                    {row.inactive.count > 0 ? (
                      <a
                        href={`/crm/hareketsiz?satici=${encodeURIComponent(row.owner)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'underline' }}
                        title="Hareketsiz firmaları yeni sekmede görmek için tıkla"
                      >
                        <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', background: 'rgba(220,38,38,0.15)' }}>
                          {row.inactive.count}
                        </span>
                      </a>
                    ) : (
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(21,128,61,0.15)', color: '#15803d' }}>0</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: 'rgba(21,128,61,0.15)', color: '#15803d' }} title="Künye tamam">
                      {row.kunyeHealth.tamam}
                    </span>
                    <button
                      type="button"
                      disabled={!hasKunyeMissing}
                      onClick={() => setOpenDetail(isKunyeOpen ? null : { owner: row.owner, kind: 'kunye' })}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: hasKunyeMissing ? 'pointer' : 'default',
                        textDecoration: hasKunyeMissing ? 'underline' : 'none',
                        font: 'inherit',
                      }}
                      title={hasKunyeMissing ? 'Künyesi eksik/yok firmaları görmek için tıkla' : ''}
                    >
                      <span style={{ display: 'inline-block', minWidth: 26, padding: '2px 6px', borderRadius: 6, textAlign: 'center', fontWeight: 700, background: hasKunyeMissing ? 'rgba(220,38,38,0.15)' : 'rgba(21,128,61,0.15)', color: hasKunyeMissing ? '#dc2626' : '#15803d' }} title="Künye eksik/yok">
                        {row.missingKunyeFirms.length}
                      </span>
                    </button>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    type="button"
                    disabled={row.coveredCustomerNames.length === 0}
                    onClick={() => setOpenDetail(isCoveredOpen ? null : { owner: row.owner, kind: 'covered' })}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: row.coveredCustomerNames.length ? 'pointer' : 'default', textDecoration: row.coveredCustomerNames.length ? 'underline' : 'none', font: 'inherit' }}
                    title="Temas edilen müşterileri görmek için tıkla"
                  >
                    {row.coverage.coveredCustomers}
                  </button>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  {row.coverage.contactsPer.actual}
                  {row.coverage.contactsPer.target != null ? ` / ${row.coverage.contactsPer.target}` : ''}
                </td>
                </tr>
                {isForecastOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
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
                {isKunyeOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#dc2626' }}>Künye eksik/yok ({row.missingKunyeFirms.length}):</strong>
                      <div style={{ marginTop: 4 }}>
                        {row.missingKunyeFirms.length === 0 ? 'Yok' : row.missingKunyeFirms.join(', ')}
                      </div>
                    </td>
                  </tr>
                )}
                {isHunterOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#1d4ed8' }}>Hunter firmalar ({row.hunterFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.hunterFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isFarmerOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#15803d' }}>Farmer firmalar ({row.farmerFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.farmerFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isKasaOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#a16207' }}>Kasa firmalar ({row.kasaFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.kasaFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isBankaOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#6d28d9' }}>Banka/Finans firmalar ({row.bankaFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.bankaFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isLeadOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#475569' }}>Lead firmalar ({row.leadFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.leadFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isTotalOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong>Portföydeki tüm firmalar ({allFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{allFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isActiveOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#15803d' }}>Hareketli firmalar ({row.activeFirmNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.activeFirmNames.join(', ')}</div>
                    </td>
                  </tr>
                )}
                {isCoveredOpen && (
                  <tr style={{ background: 'var(--bg-2, #f8fafc)' }}>
                    <td colSpan={10} style={{ padding: '12px 14px', fontSize: 12 }}>
                      <strong style={{ color: '#15803d' }}>Temas edilen müşteriler ({row.coveredCustomerNames.length}):</strong>
                      <div style={{ marginTop: 4 }}>{row.coveredCustomerNames.join(', ')}</div>
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
