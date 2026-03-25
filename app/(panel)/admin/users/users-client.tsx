'use client';
import '@/styles/users-admin.css';

import { useEffect, useState } from 'react';

type AllowedUser = {
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'account_manager' | 'itsm' | 'admin' | 'user';
  is_active: boolean;
  password?: string;
  password_confirm?: string;
};

const ROLE_OPTIONS: AllowedUser['role'][] = ['super_admin', 'admin', 'account_manager', 'itsm'];

function roleLabel(role: AllowedUser['role']) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  return 'User';
}

export default function UsersClient() {
  const [rows, setRows] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AllowedUser['role']>('admin');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
      setRows((j.users as AllowedUser[]).map((u) => ({ ...u, password: '', password_confirm: '' })));
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
      if (password !== passwordConfirm) throw new Error('Şifre tekrar alanı eşleşmiyor');

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
      setPasswordConfirm('');
      setRole('admin');
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

  async function saveRow(u: AllowedUser) {
    if ((u.password || u.password_confirm) && u.password !== u.password_confirm) {
      setErr(`${u.email} için şifre tekrar alanı eşleşmiyor`);
      return;
    }

    await updateUser(u.email, {
      full_name: u.full_name ?? '',
      role: u.role,
      password: u.password?.trim() ? u.password : undefined,
    });
  }

  async function deleteUser(u: AllowedUser) {
    if (!confirm(`${u.email} silinsin mi?`)) return;
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
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Admin Paneli</span>
        <h1 className="pax-hero-title">Kullanıcı Yönetimi</h1>
        <p className="pax-hero-description">Sisteme erişim yetkisi olan kullanıcıları ekle, düzenle ve yönet.</p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Toplam Kullanıcı</div><div className="pax-hero-stat-value">{rows.length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Admin Yetkili</div><div className="pax-hero-stat-value">{rows.filter((r) => r.role === 'admin' || r.role === 'super_admin').length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Account Manager</div><div className="pax-hero-stat-value">{rows.filter((r) => r.role === 'account_manager').length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">ITSM</div><div className="pax-hero-stat-value">{rows.filter((r) => r.role === 'itsm').length}</div></div>
        </div>
      </div>

      <form onSubmit={createUser} className="surface" style={{ display: 'grid', gap: 14 }}>
        <div className="toolbar">
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Yeni kullanıcı ekle</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Allowlist ve giriş kullanıcısı aynı akışta oluşturulur.</div>
          </div>
          <button disabled={busy} type="submit" className="primary">{busy ? 'Kaydediliyor...' : 'Kullanıcı Oluştur'}</button>
        </div>

        <div className="grid">
          <label className="field"><span className="label">Email</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" /></label>
          <label className="field"><span className="label">Ad Soyad</span><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
          <label className="field"><span className="label">Rol</span><select className="select" value={role} onChange={(e) => setRole(e.target.value as AllowedUser['role'])}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
          <label className="field"><span className="label">Şifre</span><input className="input" value={password} onChange={(e) => setPassword(e.target.value)} required type="password" /></label>
          <label className="field"><span className="label">Şifre Tekrar</span><input className="input" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required type="password" /></label>
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
                  <th>Yeni Şifre</th>
                  <th>Şifre Tekrar</th>
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
                    <td><input className="input" type="password" placeholder="Boşsa değişmez" value={u.password ?? ''} onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, password: e.target.value } : x))} /></td>
                    <td><input className="input" type="password" placeholder="Tekrar" value={u.password_confirm ?? ''} onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, password_confirm: e.target.value } : x))} /></td>
                    <td>{u.is_active ? 'true' : 'false'}</td>
                    <td>
                      <div className="actions">
                        <button disabled={busy} onClick={() => saveRow(u)} className="primary">Kaydet</button>
                        <button disabled={busy} onClick={() => updateUser(u.email, { is_active: !u.is_active })} className="secondary">{u.is_active ? 'Pasife çek' : 'Aktifleştir'}</button>
                        <button disabled={busy} onClick={() => deleteUser(u)} className="danger">Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={7} style={{ padding: 16, color: '#64748b' }}>Kayıt yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
