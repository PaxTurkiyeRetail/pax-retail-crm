import { requireAllowedUserOrThrow } from '@/lib/authz';
import RequestsHub from '@/components/requests/RequestsHub';

export default async function RequestsPage() {
  const user = await requireAllowedUserOrThrow();
  return <RequestsHub userRole={user.role} userId={user.id} />;
}
