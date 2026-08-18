import { requireCrmAccessOrThrow } from '@/lib/authz';
import CrmCustomersClient from '@/components/crm/CrmCustomersClient';

export default async function CrmCustomersPage() {
  await requireCrmAccessOrThrow();
  return (
    <div className="pax-page-container">
      <CrmCustomersClient />
    </div>
  );
}
