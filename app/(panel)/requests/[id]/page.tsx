import { requireAllowedUserOrThrow } from '@/lib/authz';
import RequestDetail from '@/components/requests/RequestDetail';

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAllowedUserOrThrow();
  return <RequestDetail id={params.id} userRole={user.role} />;
}
