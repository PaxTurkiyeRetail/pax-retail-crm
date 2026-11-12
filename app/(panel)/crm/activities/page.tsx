import { requireActivityReadOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import ActivitiesDashboardClient from './ActivitiesDashboardClient';

export default async function ActivitiesPage() {
  await requireActivityReadOrThrow();
  await requireScreenAccessOrThrow('screen.crm.activities.view');
  // Aktiviteler herkese açık: departman ve satıcı filtreleri kullanıcının departmanıyla daraltılmaz.
  const ownerOptions = await loadOwnerOptions({ departments: null });
  return <ActivitiesDashboardClient ownerOptions={ownerOptions} allowedDepartments={null} />;
}
