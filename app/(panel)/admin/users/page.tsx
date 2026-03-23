import { requireUsersAccessOrThrow } from '@/lib/authz';
import UsersClient from './users-client';

export default async function AdminUsersPage() {
  await requireUsersAccessOrThrow();

  return (
    <div className="pax-page-container">
      <div className="pax-hero">
        <span className="pax-hero-eyebrow">Kurumsal CRM · Yönetim</span>
        <h1 className="pax-hero-title">Kullanıcılar</h1>
        <p className="pax-hero-description">
          Super Admin bu ekrandan allowlist ve Auth kullanıcılarını yönetir. Rol ataması, aktif/pasif durumu ve şifre sıfırlama buradan yapılır.
        </p>
      </div>
      <UsersClient />
    </div>
  );
}
