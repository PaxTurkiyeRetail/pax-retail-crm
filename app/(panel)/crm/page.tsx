import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import CrmDashboardClient from '@/components/crm/CrmDashboardClient';

export default async function CrmPage() {
  await requireCrmAccessOrThrow();
  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="dashboard" />
      <CrmDashboardClient />
    </div>
  );
}
