'use client';

import { useEffect, useState } from 'react';

type Mapping = {
  id: string;
  tenant_id: string;
  group_id: string;
  role: 'super_admin' | 'admin' | 'account_manager' | 'itsm' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EffectivePermissionsResult = {
  email: string;
  adLinked: boolean;
  tenantId?: string;
  lastLoginAt?: string | null;
  groups: string[];
  matchedMappings: Array<{ id: string; group_id: string; role: string }>;
  effectiveRoles: string[];
  permissions: string[];
  storedRole?: string;
  roleDrift?: boolean;
  graphError?: string | null;
  note?: string;
};

const ROLE_OPTIONS: Mapping['role'][] = ['super_admin', 'admin', 'account_manager', 'itsm', 'user'];

function roleLabel(role: string) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  return 'User';
}

function GroupMappingsTab() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState<Mapping['role']>('user');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/identity/group-mappings', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? 'Yüklenemedi.');
      setMappings(j.mappings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createMapping(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/identity/group-mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId.trim(), groupId: groupId.trim(), role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? 'Oluşturulamadı.');
      setTenantId('');
      setGroupId('');
      setRole('user');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function patchMapping(id: string, payload: { role?: Mapping['role']; isActive?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/identity/group-mappings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? 'Güncellenemedi.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMapping(m: Mapping) {
    if (!confirm(`${m.group_id} (${roleLabel(m.role)}) eşlemesi silinsin mi?`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/identity/group-mappings', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: m.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? 'Silinemedi.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error ? <div style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div> : null}

      <form onSubmit={createMapping} className="pax-card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Yeni AD Grup Eşlemesi</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Tenant ID</span>
            <input required value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Entra Tenant ID" style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Entra Group Object ID</span>
            <input required value={groupId} onChange={(e) => setGroupId(e.target.value)} placeholder="Grup Object ID (GUID)" style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Mapping['role'])} style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </label>
        </div>
        <div>
          <button type="submit" disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, background: '#1e3a8a', color: 'white', fontWeight: 700, border: 'none' }}>
            {busy ? 'Kaydediliyor...' : 'Eşleme Ekle'}
          </button>
        </div>
      </form>

      <div className="pax-card">
        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Tenant</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Group Object ID</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Rol</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>Aktif</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 12 }}>{m.tenant_id}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 12 }}>{m.group_id}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                      <select
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => patchMapping(m.id, { role: e.target.value as Mapping['role'] })}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                      <input
                        type="checkbox"
                        checked={m.is_active}
                        disabled={busy}
                        onChange={(e) => patchMapping(m.id, { isActive: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteMapping(m)}
                        style={{ padding: '6px 12px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', border: 'none', fontWeight: 700 }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {mappings.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 16, color: '#64748b' }}>Kayıt yok.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Son aktif super_admin grup eşlemesi silinemez, pasife çekilemez veya başka role indirilemez —
        sistemin kilitlenmesini önlemek için backend&apos;de korunur.
      </div>
    </div>
  );
}

function EffectivePermissionsTab() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<EffectivePermissionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`/api/admin/identity/effective-permissions?email=${encodeURIComponent(email.trim())}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? 'Sorgulanamadı.');
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sorgulanamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <form onSubmit={lookup} className="pax-card" style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4, flex: 1, minWidth: 220 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Kullanıcı email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kullanici@sirket.com" style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} />
        </label>
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, background: '#1e3a8a', color: 'white', fontWeight: 700, border: 'none' }}>
          {loading ? 'Sorgulanıyor...' : 'Etkili Yetkileri Göster'}
        </button>
      </form>

      {error ? <div style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div> : null}

      {result ? (
        <div className="pax-card" style={{ display: 'grid', gap: 14 }}>
          {!result.adLinked ? (
            <div style={{ color: '#b45309' }}>{result.note}</div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 4 }}>
                <div><strong>Tenant:</strong> <span style={{ fontFamily: 'monospace' }}>{result.tenantId}</span></div>
                <div><strong>Son giriş:</strong> {result.lastLoginAt ? new Date(result.lastLoginAt).toLocaleString('tr-TR') : '—'}</div>
                <div><strong>Efektif roller (AD grup → mapping, union):</strong> {result.effectiveRoles?.length ? result.effectiveRoles.map(roleLabel).join(', ') : 'Eşleşen aktif grup yok — erişim reddedilir'}</div>
                {result.roleDrift ? (
                  <div style={{ color: '#b45309' }}>
                    Not: DB&apos;deki kayıtlı rol ({result.storedRole ? roleLabel(result.storedRole) : '—'}) güncel değil,
                    kullanıcı bir sonraki girişte senkronize olacak.
                  </div>
                ) : null}
                {result.graphError ? <div style={{ color: '#b91c1c' }}>Graph hatası: {result.graphError}</div> : null}
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>AD Grup Üyelikleri ({result.groups.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.groups.map((g) => (
                    <span key={g} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f1f5f9' }}>{g}</span>
                  ))}
                  {result.groups.length === 0 ? <span style={{ color: '#64748b' }}>Grup üyeliği yok</span> : null}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Eşleşen Rol Mapping&apos;leri ({result.matchedMappings.length})</div>
                {result.matchedMappings.length === 0 ? (
                  <div style={{ color: '#64748b' }}>Hiçbiri eşleşmedi</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {result.matchedMappings.map((m) => (
                      <li key={m.id} style={{ fontSize: 13 }}>
                        <span style={{ fontFamily: 'monospace' }}>{m.group_id}</span> → {roleLabel(m.role)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>RBAC Efektif Yetkiler ({result.permissions.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.permissions.map((p) => (
                    <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: p.startsWith('screen.') ? '#ede9fe' : '#dcfce7' }}>{p}</span>
                  ))}
                  {result.permissions.length === 0 ? <span style={{ color: '#64748b' }}>Yetki yok</span> : null}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function IdentityClient() {
  const [tab, setTab] = useState<'mappings' | 'effective'>('mappings');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={() => setTab('mappings')}
          style={{
            padding: '10px 16px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: tab === 'mappings' ? '2px solid #1e3a8a' : '2px solid transparent',
            color: tab === 'mappings' ? '#1e3a8a' : '#64748b',
            cursor: 'pointer',
          }}
        >
          AD Grup Eşlemeleri
        </button>
        <button
          type="button"
          onClick={() => setTab('effective')}
          style={{
            padding: '10px 16px',
            fontWeight: 700,
            border: 'none',
            background: 'none',
            borderBottom: tab === 'effective' ? '2px solid #1e3a8a' : '2px solid transparent',
            color: tab === 'effective' ? '#1e3a8a' : '#64748b',
            cursor: 'pointer',
          }}
        >
          Etkili Kullanıcı Yetkileri
        </button>
      </div>
      {tab === 'mappings' ? <GroupMappingsTab /> : <EffectivePermissionsTab />}
    </div>
  );
}
