'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canManageRequests } from '@/lib/roles';

type Options = {
  categories: { id: string; name: string; color: string; sla_hours: number }[];
  users: { user_id: string; full_name: string; role: string }[];
  teams?: { id: string; name: string }[];
};

export default function NewRequestForm({ userRole, onCreated }: { userRole: string; onCreated?: () => void }) {
  const router = useRouter();
  const canAssign = canManageRequests(userRole);
  const [options, setOptions] = useState<Options>({ categories: [], users: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');

  useEffect(() => {
    fetch('/api/requests/options').then(r => r.json()).then(setOptions).catch(() => {});
  }, []);

  const selectedCat = options.categories.find(c => c.id === categoryId);

  const submit = async () => {
    if (!title.trim()) {
      setError('Başlık zorunlu');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category_id: categoryId || null,
          priority,
          assignee_id: canAssign ? (assigneeId || null) : null,
          due_at: dueAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Kayıt başarısız');
      if (onCreated) {
        onCreated();
      } else {
        window.location.href = `/requests/${json.id}`;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="pax-page-container">
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: 28, display: 'grid', gap: 20, maxWidth: 680 }}>
        {error && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>}

        <Field label="Başlık *">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ne istiyorsun? Kısa ve net yaz." style={inputStyle} />
        </Field>

        <Field label="Açıklama">
          <textarea value={description} onChange={e => setDesc(e.target.value)} placeholder="Detayları buraya ekle..." rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Kategori">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">Kategori seç</option>
              {options.categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.sla_hours}s SLA)</option>)}
            </select>
          </Field>
          <Field label="Öncelik">
            <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle}>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {canAssign && (
            <Field label="Ata (opsiyonel)">
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} style={inputStyle}>
                <option value="">Atanmamış</option>
                {options.users.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Hedef Tarih (opsiyonel)">
            <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {selectedCat && (
          <div style={{ padding: '12px 16px', background: selectedCat.color + '18', border: `1px solid ${selectedCat.color}44`, borderRadius: 12, fontSize: 13, color: selectedCat.color }}>
            SLA: Bu kategori için yanıt süresi <strong>{selectedCat.sla_hours} saat</strong>.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button onClick={() => router.push('/requests')} style={{ padding: '11px 20px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
            İptal
          </button>
          <button onClick={submit} disabled={saving || !title.trim()} style={{ padding: '11px 24px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving || !title.trim() ? .6 : 1 }}>
            {saving ? 'Kaydediliyor...' : 'Talebi Oluştur'}
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: '100%' };
