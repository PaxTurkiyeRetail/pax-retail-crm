import { requireUsersAccessOrThrow } from '@/lib/authz';
import UsersClient from './users-client';

export default async function AdminUsersPage() {
  await requireUsersAccessOrThrow();

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid #dbe4ef', background: 'rgba(255,255,255,.96)', borderRadius: 24, padding: 18, boxShadow: '0 18px 40px rgba(15,23,42,.05)' }}>
        <div style={{ display: 'inline-flex', minHeight: 32, alignItems: 'center', padding: '0 12px', borderRadius: 999, background: '#edf4ff', color: '#1d4ed8', border: '1px solid #c7d7ea', fontSize: 12, fontWeight: 900 }}>Kurumsal CRM · Yönetim</div>
        <h1 style={{ margin: '12px 0 0', fontSize: 'clamp(28px, 3vw, 40px)', letterSpacing: '-.05em' }}>Kullanıcılar</h1>
        <p style={{ color: '#64748b', marginTop: 8 }}>Super Admin bu ekrandan allowlist ve Auth kullanıcılarını kompakt bir yönetim düzeniyle yönetir.</p>
      </section>
      <UsersClient />
    </main>
  );
}
