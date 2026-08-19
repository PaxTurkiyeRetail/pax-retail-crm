import { requireAdminOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CrmApprovalsClient from '@/components/crm/CrmApprovalsClient';

export default async function CrmApprovalsPage() {
  await requireAdminOrThrow();
  await requireScreenAccessOrThrow('screen.crm.approvals.view');
  return (
    <div className="pax-page-container">
      <CrmApprovalsClient />
    </div>
  );
}
