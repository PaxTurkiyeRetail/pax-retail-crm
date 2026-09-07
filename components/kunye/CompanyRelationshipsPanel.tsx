'use client';

import { useCallback, useEffect, useState } from 'react';

type Relation = { role_key: 'customer' | 'business_partner'; subtype: string | null; is_active: boolean };
const SUBTYPES = ['Entegrasyon Firması', 'Donanım Firması'];

export default function CompanyRelationshipsPanel({ customerId, onChanged }: { customerId: string; onChanged?: () => void }) {
  const [customer, setCustomer] = useState(false);
  const [partner, setPartner] = useState(false);
  const [subtype, setSubtype] = useState('Entegrasyon Firması');
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/relationships?customer_id=${encodeURIComponent(customerId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Firma ilişkileri yüklenemedi.');
      const rows: Relation[] = data.rows || [];
      setCustomer(Boolean(rows.find((row) => row.role_key === 'customer')?.is_active));
      const partnerRow = rows.find((row) => row.role_key === 'business_partner');
      setPartner(Boolean(partnerRow?.is_active));
      setSubtype(partnerRow?.subtype || 'Entegrasyon Firması');
      setCanEdit(Boolean(data.can_edit));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Firma ilişkileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!customer && !partner) {
      setMessage('Firma en az bir role sahip olmalıdır.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/crm/relationships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, customer, business_partner: partner, partner_subtype: partner ? subtype : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Firma ilişkileri kaydedilemedi.');
      setMessage('Firma rolleri kaydedildi.');
      onChanged?.();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Firma ilişkileri kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return <section id="company-relations" className="pax-card relations-card" aria-labelledby="company-relations-heading">
    <style jsx>{`
      .relations-card { margin-top: 24px; display: grid; gap: 18px; }
      .relations-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .relations-head h2 { margin: 0 0 5px; font-size: 21px; }
      .relations-head p { margin: 0; color: var(--text-3); line-height: 1.55; }
      .role-count { flex: 0 0 auto; padding: 7px 11px; border: 1px solid var(--accent-border); border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 900; }
      .role-form { border: 0; padding: 0; margin: 0; display: grid; gap: 16px; }
      .role-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .role-option { display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding: 15px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); cursor: pointer; }
      .role-option.active { border-color: var(--accent-border); background: var(--accent-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent); }
      .role-option input { width: 18px; height: 18px; margin: 2px 0 0; flex: 0 0 auto; accent-color: var(--accent); }
      .role-copy { display: grid; gap: 3px; min-width: 0; }
      .role-title { color: var(--text); font-weight: 900; }
      .role-description { color: var(--text-3); font-size: 12px; line-height: 1.45; }
      .partner-type { display: grid; gap: 7px; }
      .actions { display: flex; justify-content: flex-end; }
      .save-button { width: auto; min-width: 180px; }
      .message { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); color: var(--text-2); font-size: 13px; }
      @media (max-width: 720px) { .relations-head { display: grid; } .role-count { width: fit-content; } .role-grid { grid-template-columns: 1fr; } .save-button { width: 100%; } }
    `}</style>

    <div className="relations-head">
      <div>
        <h2 id="company-relations-heading">Firma Rolleri</h2>
        <p>Aynı firma müşteri ve iş ortağı rollerini birlikte taşıyabilir. Her rolün fazı ayrı ilerler.</p>
      </div>
      {!loading ? <span className="role-count">{Number(customer) + Number(partner)} aktif rol</span> : null}
    </div>

    {loading ? <p role="status" className="message">Firma rolleri yükleniyor...</p> : <fieldset disabled={!canEdit || saving} className="role-form">
      <div className="role-grid">
        <label className={`role-option ${customer ? 'active' : ''}`}>
          <input type="checkbox" checked={customer} onChange={(event) => setCustomer(event.target.checked)} />
          <span className="role-copy"><span className="role-title">Müşteri</span><span className="role-description">Satış ve müşteri pipeline fazları kullanılır.</span></span>
        </label>
        <label className={`role-option ${partner ? 'active' : ''}`}>
          <input type="checkbox" checked={partner} onChange={(event) => setPartner(event.target.checked)} />
          <span className="role-copy"><span className="role-title">İş Ortağı</span><span className="role-description">Entegrasyon veya donanım iş ortaklığı fazları kullanılır.</span></span>
        </label>
      </div>
      {partner ? <label className="partner-type pax-label">İş Ortağı Türü
        <select className="pax-input" value={subtype} onChange={(event) => setSubtype(event.target.value)}>
          {SUBTYPES.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label> : null}
      {canEdit ? <div className="actions"><button type="button" className="pax-btn pax-btn-primary save-button" disabled={saving || (!customer && !partner)} onClick={() => void save()}>{saving ? 'Kaydediliyor...' : 'Firma Rollerini Kaydet'}</button></div> : null}
    </fieldset>}
    {message ? <p role="status" className="message">{message}</p> : null}
  </section>;
}
