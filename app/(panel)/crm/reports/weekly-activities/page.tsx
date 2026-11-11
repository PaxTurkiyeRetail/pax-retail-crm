import { getUserDepartments, requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';
import WeeklyActivitiesReportClient from './WeeklyActivitiesReportClient';

export default async function WeeklyActivitiesReportPage() {
  const me = await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  const allowedDepartments = await getUserDepartments(me);
  const ownerOptions = await loadOwnerOptions({ departments: allowedDepartments });
  return <WeeklyActivitiesReportClient ownerOptions={ownerOptions} allowedDepartments={allowedDepartments} />;
}
