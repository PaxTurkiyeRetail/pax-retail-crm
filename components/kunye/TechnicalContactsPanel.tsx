'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TechnicalContact } from '@/lib/technical-contacts';

const empty = { full_name: '', phone: '', email: '', title: '' };
export default function TechnicalContactsPanel({ customerId }: { customerId: string }) {
  const [rows, setRows] = useState<TechnicalContact[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TechnicalContact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/technical-contacts?customer_id=${encodeURIComponent(customerId)}`, { cache: 'no-store', signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Yetkililer yüklenemedi.');
      setRows(data.rows); setCanEdit(data.can_edit); setError('');
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Yetkililer yüklenemedi.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [customerId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function save(contact?: TechnicalContact) {
    setBusy(true); setError('');
    const target = contact || editing;
    try {
      const res = await fetch('/api/crm/technical-contacts', {
        method: target ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId,
          ...(target ? { id: target.id, expected_version: target.version } : {}),
          ...(contact ? { is_active: !contact.is_active } : form) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Kayıt tamamlanamadı.');
      if (!contact) { setShowForm(false); setEditing(null); setForm(empty); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kayıt tamamlanamadı.'); }
    finally { setBusy(false); }
  }
  return <section id="technical-contacts" className="pax-card" style={{ marginTop: 24, minWidth: 0 }} aria-labelledby="technical-contacts-heading">
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 id="technical-contacts-heading">Teknik Yetkililer</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="pax-btn" disabled={busy || loading} onClick={() => void load()}>Yenile</button>
        {canEdit && <button type="button" className="pax-btn" disabled={busy} onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }}>Yetkili Ekle</button>}
      </div>
    </div>
    <p>Firma ile yürütülen entegrasyon çalışmalarındaki teknik iletişim kişileri.</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {loading ? <p role="status">Yükleniyor...</p> : !rows.length && !error ? <p>Henüz teknik yetkili eklenmemiş.</p> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
      {rows.map(row => <article key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, minWidth: 0, overflowWrap: 'anywhere' }}>
        <strong>{row.full_name}</strong> {!row.is_active && <span>· Pasif</span>}
        <p>{row.title || 'Ünvan belirtilmemiş'}</p>
        <p>Telefon: {row.phone || '—'}</p><p>E-posta: {row.email || '—'}</p>
        {canEdit && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="pax-btn" disabled={busy} onClick={() => { setEditing(row); setForm({ full_name: row.full_name, phone: row.phone || '', email: row.email || '', title: row.title || '' }); setShowForm(true); }}>Düzenle</button>
          <button type="button" className="pax-btn" disabled={busy} onClick={() => void save(row)}>{row.is_active ? 'Pasife Al' : 'Aktifleştir'}</button>
        </div>}
      </article>)}
    </div>
    {canEdit && showForm && <form onSubmit={e => { e.preventDefault(); void save(); }} style={{ marginTop: 20 }}>
      <h3>{editing ? 'Teknik Yetkiliyi Düzenle' : 'Yeni Teknik Yetkili'}</h3>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
        {(['full_name', 'phone', 'email', 'title'] as const).map(field => <label key={field} style={{ minWidth: 0 }}>
          {{ full_name: 'Ad Soyad *', phone: 'Telefon', email: 'E-posta', title: 'Ünvan' }[field]}
          <input className="pax-input" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} required={field === 'full_name'} maxLength={{ full_name: 160, phone: 40, email: 254, title: 120 }[field]} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} />
        </label>)}
      </fieldset>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="pax-btn" disabled={busy} type="submit">{busy ? 'Kaydediliyor...' : 'Kaydet'}</button>
        <button className="pax-btn" disabled={busy} type="button" onClick={() => setShowForm(false)}>Vazgeç</button>
      </div>
    </form>}
  </section>;
}
