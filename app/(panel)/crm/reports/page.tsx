import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import WeeklyManagementPresentationLegacyClient from './WeeklyManagementPresentationLegacyClient';

export default async function ReportsPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <WeeklyManagementPresentationLegacyClient />;
}
