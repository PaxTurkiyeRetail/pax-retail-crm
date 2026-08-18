import { requireAllowedUserOrThrow } from '@/lib/authz';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  account_manager: 'Account Manager',
  itsm: 'ITSM',
  user: 'Kullanıcı',
};

export default async function MyHomePage() {
  const user = await requireAllowedUserOrThrow();
  const permissions = [...(user.permissions ?? [])].sort((a, b) => a.localeCompare(b, 'tr'));

  return (
    <main className="pax-page-container">
      <section className="pax-hero">
        <span className="pax-hero-eyebrow">Hesabım</span>
        <h1 className="pax-hero-title">{user.full_name || user.email}</h1>
        <p className="pax-hero-description">
          Hesap kimliğiniz, atanmış rolünüz ve etkin yetkileriniz. Hedef ve performans verileri yalnızca gerçek veri kaynağı bağlandığında burada gösterilecektir.
        </p>
      </section>

      <section className="pax-card" style={{ padding: 24, display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div><small style={{ color: 'var(--text-3)' }}>E-posta</small><div style={{ marginTop: 5, fontWeight: 800 }}>{user.email}</div></div>
          <div><small style={{ color: 'var(--text-3)' }}>Rol</small><div style={{ marginTop: 5, fontWeight: 800 }}>{roleLabels[user.role] ?? user.role}</div></div>
          <div><small style={{ color: 'var(--text-3)' }}>Hesap durumu</small><div style={{ marginTop: 5, fontWeight: 800, color: '#15803d' }}>Aktif</div></div>
        </div>

        <div>
          <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Etkin yetkiler</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {permissions.length ? permissions.map((permission) => (
              <span key={permission} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface-2)', fontSize: 12, fontWeight: 700 }}>
                {permission}
              </span>
            )) : <span style={{ color: 'var(--text-3)' }}>Atanmış uygulama yetkisi bulunmuyor.</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
