import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import WeeklyActivitiesReportClient from './WeeklyActivitiesReportClient';

export default async function WeeklyActivitiesReportPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <WeeklyActivitiesReportClient />;
}
