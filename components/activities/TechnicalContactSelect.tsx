'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TechnicalContact } from '@/lib/technical-contacts';

export default function TechnicalContactSelect({ customerId, value, originalId, onChange }: {
  customerId: string; value: string | null; originalId: string | null; onChange: (id: string | null) => void;
}) {
  const [rows, setRows] = useState<TechnicalContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void (async () => {
      try {
        const res = await fetch(`/api/crm/technical-contacts?customer_id=${encodeURIComponent(customerId)}`, { cache: 'no-store', signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Yetkililer yüklenemedi.');
        setRows(data.rows);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Yetkililer yüklenemedi.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [customerId, refresh]);
  const selected = rows.find(row => row.id === value);
  return <div style={{ minWidth: 0 }}>
    <label className="pax-label" htmlFor="activity-technical-contact">Teknik Yetkili (isteğe bağlı)</label>
    <select id="activity-technical-contact" className="pax-input" style={{ width: '100%', minWidth: 0 }} value={value || ''} disabled={loading || !!error} onChange={e => onChange(e.target.value || null)}>
      <option value="">{loading ? 'Yetkililer yükleniyor...' : 'Yetkili seçin'}</option>
      {rows.filter(row => row.is_active || row.id === originalId).map(row => <option key={row.id} value={row.id}>{row.full_name}{row.title ? ` · ${row.title}` : ''}{row.is_active ? '' : ' (Pasif)'}</option>)}
      {value && !selected && <option value={value}>Mevcut yetkili bağlantısı</option>}
    </select>
    {selected && <p style={{ overflowWrap: 'anywhere' }}>{[selected.phone, selected.email].filter(Boolean).join(' · ') || 'İletişim bilgisi belirtilmemiş.'}</p>}
    {error && <p role="alert">{error} Mevcut yetkili bağlantısı korunur.</p>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
      <Link href={`/crm/${customerId}#technical-contacts`} target="_blank" rel="noopener noreferrer">Firma Teknik Yetkilileri</Link>
      <button type="button" className="pax-btn" disabled={loading} onClick={() => setRefresh(v => v + 1)}>Yetkilileri Yenile</button>
    </div>
  </div>;
}
