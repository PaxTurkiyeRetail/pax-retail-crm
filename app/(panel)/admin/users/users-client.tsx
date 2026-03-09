'use client';

import { useEffect, useState } from 'react';

type AllowedUser = {
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'account_manager' | 'itsm' | 'admin' | 'user';
  is_active: boolean;
};

const ROLE_OPTIONS: AllowedUser['role'][] = ['super_admin', 'account_manager', 'itsm'];

function roleLabel(role: AllowedUser['role']) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  if (role === 'admin') return 'Admin (legacy)';
  return 'User (legacy)';
}

export default function UsersClient() {
  const [rows, setRows] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AllowedUser['role']>('account_manager');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.message || 'Liste alınamadı'); }
      const j = await r.json();
      setRows(j.users as AllowedUser[]);
    } catch (e: any) { setErr(e.message || 'Hata'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, full_name: fullName, role, password }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.message || 'Kullanıcı oluşturulamadı'); }
      setEmail(''); setFullName(''); setPassword(''); setRole('account_manager'); await load();
    } catch (e: any) { setErr(e.message || 'Hata'); } finally { setBusy(false); }
  }

  async function updateUser(email: string, payload: Partial<AllowedUser>) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.message || 'Güncellenemedi'); }
      await load();
    } catch (e: any) { setErr(e.message || 'Hata'); } finally { setBusy(false); }
  }

  async function deleteUser(u: AllowedUser) {
    if (!confirm(`${u.email} silinsin mi? (Auth + allowed_users)`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(u.email)}`, { method: 'DELETE' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.message || 'Silinemedi'); }
      await load();
    } catch (e: any) { setErr(e.message || 'Hata'); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <form onSubmit={createUser} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Yeni kullanıcı ekle</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>Ad Soyad<input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>Rol<select value={role} onChange={(e) => setRole(e.target.value as AllowedUser['role'])} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>Şifre (admin belirler)<input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} /></label>
        </div>
        <button disabled={busy} type="submit" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white', fontWeight: 700 }}>{busy ? '...' : 'Kullanıcı Oluştur'}</button>
        {err ? <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', padding: 10, borderRadius: 10 }}>{err}</div> : null}
      </form>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', fontWeight: 700 }}>Allowed Users</div>
        {loading ? <div style={{ padding: 12, color: '#6b7280' }}>Yükleniyor...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left' }}><th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Email</th><th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Ad Soyad</th><th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Rol</th><th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Aktif</th><th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }} /></tr></thead>
            <tbody>
              {rows.map((u) => <tr key={u.email}><td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{u.email}</td><td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}><input value={u.full_name ?? ''} onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, full_name: e.target.value } : x))} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} /></td><td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}><select value={u.role} onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, role: e.target.value as AllowedUser['role'] } : x))} style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></td><td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{u.is_active ? 'true' : 'false'}</td><td style={{ padding: 10, borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}><button disabled={busy} onClick={() => updateUser(u.email, { full_name: u.full_name ?? '', role: u.role })} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white' }}>Kaydet</button><button disabled={busy} onClick={() => updateUser(u.email, { is_active: !u.is_active })} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white' }}>{u.is_active ? 'Pasife çek' : 'Aktifleştir'}</button><button disabled={busy} onClick={() => deleteUser(u)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ef4444', background: '#ef4444', color: 'white' }}>Sil</button></td></tr>)}
              {rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 12, color: '#6b7280' }}>Kayıt yok.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
