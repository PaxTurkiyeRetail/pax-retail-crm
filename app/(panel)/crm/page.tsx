import CrmDashboardClient from '@/components/crm/CrmDashboardClient';
import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow, requireScreenAccessOrThrow, userHasPermission } from '@/lib/authz';

export default async function CrmPage() {
  const user = await requireAllowedUserOrThrow();
  await requireScreenAccessOrThrow('screen.crm.dashboard.view');
  if (!userHasPermission(user, 'customer.read')) {
    if (userHasPermission(user, 'request.read.own') || userHasPermission(user, 'request.read.all') || userHasPermission(user, 'request.create')) redirect('/requests');
    redirect('/login');
  }
  return <CrmDashboardClient />;
}
