'use client';
import '@/styles/users-admin.css';

import { useEffect, useState } from 'react';

type AllowedUser = {
  email: string;
  full_name: string | null;
  role: 'super_admin' | 'account_manager' | 'itsm' | 'admin' | 'user';
  secondary_roles: string[] | null;
  is_active: boolean;
  auth_provider: 'local' | 'active_directory' | null;
  auth_tenant_id: string | null;
  auth_last_login_at: string | null;
  weekly_target_sales_physical: number;
  weekly_target_sales_online: number;
  weekly_target_sales_phone: number;
  weekly_target_sales_email: number;
  weekly_target_technical_physical: number;
  weekly_target_technical_online: number;
  weekly_target_unique_customers: number;
  weekly_target_total_activities: number;
};

const WEEKLY_TARGET_FIELDS: Array<{ key: keyof Pick<AllowedUser, 'weekly_target_sales_physical' | 'weekly_target_sales_online' | 'weekly_target_sales_phone' | 'weekly_target_sales_email' | 'weekly_target_technical_physical' | 'weekly_target_technical_online' | 'weekly_target_total_activities' | 'weekly_target_unique_customers'>; label: string; short: string }> = [
  { key: 'weekly_target_sales_physical', label: 'Haftalık Satış Fiziki Hedefi', short: 'Satış Fiziki' },
  { key: 'weekly_target_sales_online', label: 'Haftalık Satış Online Hedefi', short: 'Satış Online' },
  { key: 'weekly_target_sales_phone', label: 'Haftalık Satış Telefon Hedefi', short: 'Satış Telefon' },
  { key: 'weekly_target_sales_email', label: 'Haftalık Satış E-posta Hedefi', short: 'Satış E-posta' },
  { key: 'weekly_target_technical_physical', label: 'Haftalık Teknik Fiziki Hedefi', short: 'Teknik Fiziki' },
  { key: 'weekly_target_technical_online', label: 'Haftalık Teknik Online Hedefi', short: 'Teknik Online' },
  { key: 'weekly_target_total_activities', label: 'Haftalık Toplam Aktivite Hedefi', short: 'Toplam Aktivite' },
  { key: 'weekly_target_unique_customers', label: 'Haftalık Tekil Firma Hedefi', short: 'Tekil Firma' },
];

function normalizeWeeklyTargets(user: AllowedUser): AllowedUser {
  const next = { ...user };
  for (const field of WEEKLY_TARGET_FIELDS) {
    next[field.key] = Number(next[field.key] ?? 0) || 0;
  }
  return next;
}

function targetPayload(user: AllowedUser) {
  return Object.fromEntries(WEEKLY_TARGET_FIELDS.map((field) => [field.key, Number(user[field.key] ?? 0) || 0]));
}

function targetSummary(user: AllowedUser) {
  const filled = WEEKLY_TARGET_FIELDS.filter((field) => Number(user[field.key] ?? 0) > 0);
  if (filled.length === 0) return 'Hedef girilmedi';
  const total = WEEKLY_TARGET_FIELDS.reduce((sum, field) => sum + (Number(user[field.key] ?? 0) || 0), 0);
  return `${filled.length} hedef / toplam ${total}`;
}

function roleLabel(role: AllowedUser['role']) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  if (role === 'account_manager') return 'Account Manager';
  if (role === 'itsm') return 'ITSM';
  return 'User';
}

function adStatus(user: AllowedUser) {
  if (user.auth_provider === 'active_directory') return { label: 'AD ile eşleşti', ok: true };
  if (user.auth_provider === 'local') return { label: 'Yalnız legacy giriş', ok: false };
  return { label: 'Hiç giriş yapmadı', ok: false };
}

export default function UsersClient() {
  const [rows, setRows] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [targetModalEmail, setTargetModalEmail] = useState<string | null>(null);

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
      setRows((j.users as AllowedUser[]).map((u) => normalizeWeeklyTargets(u)));
    } catch (e: any) {
      setErr(e.message || 'Hata');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  async function saveTargets(u: AllowedUser) {
    await updateUser(u.email, {
      full_name: u.full_name ?? '',
      ...targetPayload(u),
    });
  }

  return (
    <div className="users-page">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Admin Paneli</span>
        <h1 className="pax-hero-title">Kurumsal Kullanıcı Dizini</h1>
        <p className="pax-hero-description">
          Roller yalnız AD grup üyeliğinden türetilir; burada rol/şifre değiştirilemez.
          Bu ekran görüntüleme, iş hedefleri ve acil erişim engelleme (is_active) içindir.
          AD grup eşlemeleri için <strong>Kimlik ve Erişim Yönetimi</strong> ekranını kullanın.
        </p>
        <div className="pax-hero-stats">
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Toplam Kullanıcı</div><div className="pax-hero-stat-value">{rows.length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Admin Yetkili</div><div className="pax-hero-stat-value">{rows.filter((r) => r.role === 'admin' || r.role === 'super_admin').length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">AD ile Eşleşen</div><div className="pax-hero-stat-value">{rows.filter((r) => r.auth_provider === 'active_directory').length}</div></div>
          <div className="pax-hero-stat"><div className="pax-hero-stat-label">Pasif</div><div className="pax-hero-stat-value">{rows.filter((r) => !r.is_active).length}</div></div>
        </div>
      </div>

      {err ? <div className="message">{err}</div> : null}

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
                  <th>Rol (AD türevi)</th>
                  <th>AD Durumu</th>
                  <th>Son Giriş</th>
                  <th>Haftalık Hedefler</th>
                  <th>Aktif</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const status = adStatus(u);
                  return (
                    <tr key={u.email}>
                      <td>{u.email}</td>
                      <td>
                        <input
                          className="input"
                          value={u.full_name ?? ''}
                          onChange={(e) => setRows((s) => s.map((x) => x.email === u.email ? { ...x, full_name: e.target.value } : x))}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{roleLabel(u.role)}</div>
                        {u.secondary_roles && u.secondary_roles.length > 0 ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            + {u.secondary_roles.map((r) => roleLabel(r as AllowedUser['role'])).join(', ')}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ color: status.ok ? '#15803d' : '#b45309' }}>{status.label}</td>
                      <td>{u.auth_last_login_at ? new Date(u.auth_last_login_at).toLocaleString('tr-TR') : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary weekly-target-button"
                          onClick={() => setTargetModalEmail(u.email)}
                        >
                          Hedefleri Düzenle
                          <span>{targetSummary(u)}</span>
                        </button>
                      </td>
                      <td>{u.is_active ? 'true' : 'false'}</td>
                      <td>
                        <div className="actions">
                          <button
                            disabled={busy}
                            onClick={() => updateUser(u.email, { is_active: !u.is_active })}
                            className={u.is_active ? 'danger' : 'secondary'}
                            title="Acil durum erişim engeli — hesap/kayıt silinmez"
                          >
                            {u.is_active ? 'Erişimi Engelle' : 'Erişimi Geri Aç'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? <tr><td colSpan={8} style={{ padding: 16, color: '#64748b' }}>Kayıt yok.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {targetModalEmail ? (() => {
        const modalUser = rows.find((row) => row.email === targetModalEmail);
        if (!modalUser) return null;

        return (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="weekly-target-modal-title">
            <div className="modal-card weekly-target-modal">
              <div className="modal-head">
                <div>
                  <div id="weekly-target-modal-title" className="modal-title">Haftalık Hedefler</div>
                  <div className="modal-subtitle">{modalUser.full_name || modalUser.email}</div>
                </div>
                <button type="button" className="modal-close" onClick={() => setTargetModalEmail(null)} aria-label="Kapat">×</button>
              </div>

              <div className="weekly-target-grid">
                {WEEKLY_TARGET_FIELDS.map((field) => (
                  <label key={`${modalUser.email}-${field.key}-modal`} className="field">
                    <span className="label">{field.short}</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step={1}
                      value={Number(modalUser[field.key] ?? 0)}
                      onChange={(e) => setRows((s) => s.map((x) => x.email === modalUser.email ? { ...x, [field.key]: Math.max(0, Number(e.target.value) || 0) } as AllowedUser : x))}
                    />
                  </label>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setTargetModalEmail(null)}>Vazgeç</button>
                <button
                  type="button"
                  disabled={busy}
                  className="primary"
                  onClick={async () => {
                    await saveTargets(modalUser);
                    setTargetModalEmail(null);
                  }}
                >
                  {busy ? 'Kaydediliyor...' : 'Hedefleri Kaydet'}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
