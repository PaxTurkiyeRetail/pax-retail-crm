import { getUserDepartments, requireCrmAccessOrThrow, requirePermissionOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import CrmCustomersClient from '@/components/crm/CrmCustomersClient';

export default async function CrmCustomersPage() {
  const me = await requireCrmAccessOrThrow();
  await requirePermissionOrThrow('customer.read');
  await requireScreenAccessOrThrow('screen.crm.customers.view');
  const allowedDepartments = await getUserDepartments(me);
  // Satıcı filtresi yalnız customer.read.any ile anlamlı (API diğerlerinde yok sayar).
  const ownerOptions = userHasPermission(me, 'customer.read.any') ? await loadOwnerOptions({ departments: allowedDepartments }) : [];
  return (
    <div className="pax-page-container">
      <CrmCustomersClient ownerOptions={ownerOptions} allowedDepartments={allowedDepartments} />
    </div>
  );
}
