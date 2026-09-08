'use client';
import { useEffect, useState } from 'react';
type Row = { activity_type_key: string; role_key: string; label: string; can_view: boolean; can_create: boolean; can_change_phase: boolean };
export default function ActivityTypeAccessPanel() {
  const [rows, setRows] = useState<Row[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  useEffect(() => { void (async () => { const res = await fetch('/api/admin/activity-type-access', { cache: 'no-store' }); const data = await res.json(); if (res.ok) setRows(data.rows || []); else setError(data.message || 'Rol kuralları yüklenemedi.'); })(); }, []);
  async function save(row: Row, patch: Partial<Row>) {
    const next = { ...row, ...patch };
    if (!next.can_view) { next.can_create = false; next.can_change_phase = false; }
    if (!next.can_create) next.can_change_phase = false;
    setBusy(row.role_key); setError('');
    try { const res = await fetch('/api/admin/activity-type-access', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }); const data = await res.json(); if (!res.ok) throw new Error(data.message); setRows(items => items.map(item => item.role_key === row.role_key ? { ...item, ...data.row } : item)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Rol kuralı güncellenemedi.'); } finally { setBusy(''); }
  }
  return <section className="pax-card parameters-main-card" aria-labelledby="partner-activity-access-title">
    <div className="parameters-main-head"><div><span className="parameters-kicker">Aktivite Türleri / Yetkiler</span><h2 id="partner-activity-access-title">Entegrasyon Süreci</h2><p>Bu tür 14 entegrasyon fazını kullanır. Super Admin her zaman tam yetkilidir.</p></div></div>
    {error && <p role="alert">{error}</p>}
    <div className="parameters-table-wrap"><table className="pax-table parameters-table"><thead><tr><th>Rol</th><th>Görür</th><th>Oluşturur</th><th>Faz Değiştirir</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.role_key}><td><strong>{row.label}</strong></td>{(['can_view','can_create','can_change_phase'] as const).map(key => <td key={key}><input aria-label={`${row.label} ${key}`} type="checkbox" disabled={busy === row.role_key || (key === 'can_create' && !row.can_view) || (key === 'can_change_phase' && !row.can_create)} checked={row[key]} onChange={e => void save(row, { [key]: e.target.checked })} /></td>)}</tr>)}
    </tbody></table></div>
  </section>;
}
