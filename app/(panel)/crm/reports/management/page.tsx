import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import ManagementReportClient from './ManagementReportClient';

export default async function ManagementReportPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <ManagementReportClient />;
}
