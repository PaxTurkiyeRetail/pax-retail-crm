import RequestsHub from '@/components/requests/RequestsHub';
import { requireRequestsAccessOrThrow, userHasPermission } from '@/lib/authz';

export default async function RequestsPage() {
  const user = await requireRequestsAccessOrThrow();
  return <RequestsHub userRole={user.role} userId={user.id} canManage={userHasPermission(user, 'request.manage')} />;
}
