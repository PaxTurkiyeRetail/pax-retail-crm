'use client';
import { useCallback, useEffect, useState } from 'react';

type Relation = { role_key: 'customer' | 'business_partner'; subtype: string | null; is_active: boolean };
const SUBTYPES = ['Entegrasyon Firması', 'Donanım Firması'];
export default function CompanyRelationshipsPanel({ customerId, onChanged }: { customerId: string; onChanged?: () => void }) {
  const [customer, setCustomer] = useState(false); const [partner, setPartner] = useState(false);
  const [subtype, setSubtype] = useState('Entegrasyon Firması'); const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch(`/api/crm/relationships?customer_id=${encodeURIComponent(customerId)}`, { cache: 'no-store' }); const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Firma ilişkileri yüklenemedi.');
      const rows: Relation[] = data.rows || []; setCustomer(Boolean(rows.find(r => r.role_key === 'customer')?.is_active));
      const partnerRow = rows.find(r => r.role_key === 'business_partner'); setPartner(Boolean(partnerRow?.is_active));
      setSubtype(partnerRow?.subtype || 'Entegrasyon Firması'); setCanEdit(Boolean(data.can_edit)); setMessage('');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Firma ilişkileri yüklenemedi.'); } finally { setLoading(false); }
  }, [customerId]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!customer && !partner) { setMessage('Firma en az bir ilişkiye sahip olmalıdır.'); return; }
    setSaving(true); setMessage('');
    try { const res = await fetch('/api/crm/relationships', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId, customer, business_partner: partner, partner_subtype: partner ? subtype : null }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Firma ilişkileri kaydedilemedi.');
      setMessage('Firma ilişkileri kaydedildi.'); onChanged?.(); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Firma ilişkileri kaydedilemedi.'); } finally { setSaving(false); }
  }
  return <section id="company-relations" className="pax-card" style={{ marginTop: 24 }} aria-labelledby="company-relations-heading">
    <h2 id="company-relations-heading">Firma İlişkileri</h2>
    <p>Aynı firma hem müşterimiz hem iş ortağımız olabilir. İki sürecin fazları bağımsız ilerler.</p>
    {loading ? <p role="status">Yükleniyor...</p> : <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, display: 'grid', gap: 12 }}>
      <label><input type="checkbox" checked={customer} onChange={e => setCustomer(e.target.checked)} /> Müşteri</label>
      <label><input type="checkbox" checked={partner} onChange={e => setPartner(e.target.checked)} /> İş Ortağı</label>
      {partner && <label className="pax-label">İş Ortağı Türü<select className="pax-input" value={subtype} onChange={e => setSubtype(e.target.value)}>{SUBTYPES.map(v => <option key={v}>{v}</option>)}</select></label>}
      {canEdit && <button type="button" className="pax-btn" disabled={saving || (!customer && !partner)} onClick={() => void save()}>{saving ? 'Kaydediliyor...' : 'İlişkileri Kaydet'}</button>}
    </fieldset>}
    {message && <p role="status">{message}</p>}
  </section>;
}
