import { requireUsersAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import UsersClient from './users-client';

export default async function AdminUsersPage() {
  await requireUsersAccessOrThrow();
  await requireScreenAccessOrThrow('screen.admin.users.view');

  return (
    <div className="pax-page-container">
      <UsersClient />
    </div>
  );
}
