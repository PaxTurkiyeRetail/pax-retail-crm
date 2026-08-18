import RequestDetail from '@/components/requests/RequestDetail';
import { requireRequestsAccessOrThrow, userHasPermission } from '@/lib/authz';

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRequestsAccessOrThrow();
  const { id } = await params;
  return <RequestDetail id={id} userRole={user.role} canManage={userHasPermission(user, 'request.manage')} />;
}
