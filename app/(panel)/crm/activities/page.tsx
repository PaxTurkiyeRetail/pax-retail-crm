import { getUserDepartments, requireActivityReadOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import ActivitiesDashboardClient from './ActivitiesDashboardClient';

export default async function ActivitiesPage() {
  const me = await requireActivityReadOrThrow();
  await requireScreenAccessOrThrow('screen.crm.activities.view');
  const allowedDepartments = await getUserDepartments(me);
  const ownerOptions = await loadOwnerOptions({ departments: allowedDepartments });
  return <ActivitiesDashboardClient ownerOptions={ownerOptions} allowedDepartments={allowedDepartments} />;
}
