'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = {
  customerId: string;
  musteri: string;
  sorumlu: string | null;
  aktifFazNo: number | null;
  aktifFazAdi: string | null;
  sonNot: string | null;
  sonEventTarihi: string | null;
};

type Payload = {
  filters: { owner: string };
  summary: { total: number };
  rows: Row[];
  ownerOptions: string[];
};

const EMPTY: Payload = { filters: { owner: '' }, summary: { total: 0 }, rows: [], ownerOptions: [] };

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EntegrasyonRaporuClient() {
  const [owner, setOwner] = useState('');
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (ownerFilter: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (ownerFilter) params.set('owner', ownerFilter);
      const res = await fetch(`/api/reports/entegrasyon-raporu?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Rapor yüklenemedi.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(owner); }, [load, owner]);

  return (
    <main className="pax-page-container">
      <div className="pax-card" style={{ padding: 20, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Entegrasyon Raporu</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
          Entegrasyon Firması olarak işaretli iş ortaklarının aktif fazı ve son aktivite notu.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-1, #ccc)' }}
          >
            <option value="">Tüm Sorumlular</option>
            {data.ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{data.summary.total} firma</span>
        </div>
      </div>

      {error && (
        <div className="pax-card" style={{ padding: 16, marginBottom: 16, color: '#dc2626' }}>{error}</div>
      )}

      <div className="pax-card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-1, #e5e7eb)' }}>
              <th style={{ padding: '10px 14px' }}>Müşteri</th>
              <th style={{ padding: '10px 14px' }}>Sorumlu</th>
              <th style={{ padding: '10px 14px' }}>Aktif Faz</th>
              <th style={{ padding: '10px 14px' }}>Son Not</th>
              <th style={{ padding: '10px 14px' }}>Son Aktivite</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Yükleniyor…</td></tr>
            ) : data.rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Kayıt yok.</td></tr>
            ) : data.rows.map((row) => (
              <tr key={row.customerId} style={{ borderBottom: '1px solid var(--border-1, #f1f5f9)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.musteri}</td>
                <td style={{ padding: '10px 14px' }}>{row.sorumlu ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  {row.aktifFazNo != null ? `Faz ${row.aktifFazNo}${row.aktifFazAdi ? ` — ${row.aktifFazAdi}` : ''}` : '—'}
                </td>
                <td style={{ padding: '10px 14px', maxWidth: 360 }}>{row.sonNot ?? '—'}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatDate(row.sonEventTarihi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
