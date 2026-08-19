import { requireCrmAccessOrThrow, requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CrmCustomersClient from '@/components/crm/CrmCustomersClient';

export default async function CrmCustomersPage() {
  await requireCrmAccessOrThrow();
  await requirePermissionOrThrow('customer.read');
  await requireScreenAccessOrThrow('screen.crm.customers.view');
  return (
    <div className="pax-page-container">
      <CrmCustomersClient />
    </div>
  );
}
