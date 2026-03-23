import { requireCrmAccessOrThrow } from '@/lib/authz';
import CrmCustomersClient from '@/components/crm/CrmCustomersClient';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';

export default async function CrmCustomersPage() {
  await requireCrmAccessOrThrow();
  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="customerList" />
      <CrmCustomersClient />
    </div>
  );
}
