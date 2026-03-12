import { requireCrmAccessOrThrow } from '@/lib/authz';
import CrmDashboardClient from '@/components/crm/CrmDashboardClient';

export default async function CrmPage() {
  await requireCrmAccessOrThrow();
  return <CrmDashboardClient />;
}
