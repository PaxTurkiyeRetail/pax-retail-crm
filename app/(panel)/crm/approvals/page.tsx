import { requireAdminOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import CrmApprovalsClient from '@/components/crm/CrmApprovalsClient';

export default async function CrmApprovalsPage() {
  await requireAdminOrThrow();
  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="approvals" />
      <CrmApprovalsClient />
    </div>
  );
}
