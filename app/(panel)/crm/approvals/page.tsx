import { requireAdminOrThrow } from '@/lib/authz';
import CrmApprovalsClient from '@/components/crm/CrmApprovalsClient';

export default async function CrmApprovalsPage() {
  await requireAdminOrThrow();
  return <CrmApprovalsClient />;
}
