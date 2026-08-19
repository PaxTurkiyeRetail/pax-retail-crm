import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import WeeklyManagementPresentationClient from './WeeklyManagementPresentationClient';

export default async function WeeklyManagementPresentationPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <WeeklyManagementPresentationClient />;
}
