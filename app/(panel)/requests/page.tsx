import RequestsHub from '@/components/requests/RequestsHub';
import { requireRequestsAccessOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';

export default async function RequestsPage() {
  const user = await requireRequestsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.requests.view');
  return <RequestsHub userRole={user.role} userId={user.id} canManage={userHasPermission(user, 'request.manage')} />;
}
