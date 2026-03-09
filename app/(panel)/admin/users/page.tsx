import { requireUsersAccessOrThrow } from '@/lib/authz';
import UsersClient from './users-client';

export default async function AdminUsersPage() {
  await requireUsersAccessOrThrow();

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Kullanıcılar</h1>
      <p style={{ color: '#4b5563' }}>Super Admin bu ekrandan allowlist + Auth kullanıcılarını yönetir.</p>
      <UsersClient />
    </div>
  );
}
