import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import PhaseReportClient from './PhaseReportClient';

export default async function PhaseReportPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <PhaseReportClient />;
}
