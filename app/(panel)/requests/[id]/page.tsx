import RequestDetail from '@/components/requests/RequestDetail';
import { requireRequestsAccessOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRequestsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.requests.view');
  const { id } = await params;
  return <RequestDetail id={id} userRole={user.role} canManage={userHasPermission(user, 'request.manage')} />;
}
