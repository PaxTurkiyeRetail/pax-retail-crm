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
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || 'Liste alınamadı');
      }
      const j = await r.json();
      setRows(j.users as AllowedUser[]);
    } catch (e: any) {
      setErr(e.message || 'Hata');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, role, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || 'Kullanıcı oluşturulamadı');
      }
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('account_manager');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Hata');
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(email: string, payload: Partial<AllowedUser>) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || 'Güncellenemedi');
      }
      await load();
    } catch (e: any) {
      setErr(e.message || 'Hata');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(u: AllowedUser) {
    if (!confirm(`${u.email} silinsin mi? (Auth + allowed_users)`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(u.email)}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || 'Silinemedi');
      }
      await load();
    } catch (e: any) {
      setErr(e.message || 'Hata');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="users-page">
      <style jsx>{`
        .users-page { display: grid; gap: 16px; }
        .surface {
          border: 1px solid #dbe4ef; background: rgba(255,255,255,.96); border-radius: 24px; padding: 18px; box-shadow: 0 18px 40px rgba(15,23,42,.05);
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
        .field { display: grid; gap: 7px; }
        .label { font-size: 12px; font-weight: 900; color: #334155; }
        .input, .select { min-height: 42px; border-radius: 14px; border: 1px solid #d5dee8; padding: 0 13px; background: #fff; }
        .primary, .secondary, .danger { min-height: 40px; border-radius: 12px; padding: 0 12px; font-weight: 800; cursor: pointer; }
        .primary { border: 1px solid #0f172a; background: linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color: #fff; }
        .secondary { border: 1px solid #d5dee8; background: #fff; }
        .danger { border: 1px solid #ef4444; background: #ef4444; color: white; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .table-wrap { overflow: auto; border: 1px solid #e2e8f0; border-radius: 18px; }
        table { width: 100%; min-width: 940px; border-collapse: collapse; }
        th { text-align: left; padding: 11px 12px; font-size: 11px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        td { padding: 11px 12px; border-bottom: 1px solid #eef2f7; font-size: 13px; vertical-align: middle; }
        .actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
        .message { font-size: 13px; color: #b91c1c; background: #fff1f2; padding: 11px 13px; border-radius: 14px; border: 1px solid #fecdd3; }
      `}</style>

      <form onSubmit={createUser} className="surface" style={{ display: 'grid', gap: 14 }}>
        <div className="toolbar">
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Yeni kullanıcı ekle</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Allowlist ve Auth kullanıcısı aynı akışta oluşturulur.</div>
          </div>
          <button disabled={busy} type="submit" className="primary">{busy ? 'Kaydediliyor...' : 'Kullanıcı Oluştur'}</button>
        </div>

        <div className="grid">
          <label className="field"><span className="label">Email</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" /></label>
          <label className="field"><span className="label">Ad Soyad</span><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
          <label className="field"><span className="label">Rol</span><select className="select" value={role} onChange={(e) => setRole(e.target.value as AllowedUser['role'])}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
          <label className="field"><span className="label">Şifre</span><input className="input" value={password} onChange={(e) => setPassword(e.target.value)} required type="password" /></label>
        </div>

        {err ? <div className="message">{err}</div> : null}
      </form>

      <section className="surface">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Allowed Users</div>
          <div style={{ color: '#64748b', fontSize: 13 }}>{rows.length} kayıt</div>
        </div>

        {loading ? (
          <div style={{ color: '#64748b' }}>Yükleniyor...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Ad Soyad</th>
                  <th>Rol</th>
                  <th>Aktif</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.email}>
                    <td>{u.email}</td>
                    <td><input className="input" value={u.full_name ?? ''} onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, full_name: e.target.value } : x))} /></td>
                    <td><select className="select" value={u.role} onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, role: e.target.value as AllowedUser['role'] } : x))}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></td>
                    <td>{u.is_active ? 'true' : 'false'}</td>
                    <td>
                      <div className="actions">
                        <button disabled={busy} onClick={() => updateUser(u.email, { full_name: u.full_name ?? '', role: u.role })} className="primary">Kaydet</button>
                        <button disabled={busy} onClick={() => updateUser(u.email, { is_active: !u.is_active })} className="secondary">{u.is_active ? 'Pasife çek' : 'Aktifleştir'}</button>
                        <button disabled={busy} onClick={() => deleteUser(u)} className="danger">Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 16, color: '#64748b' }}>Kayıt yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
