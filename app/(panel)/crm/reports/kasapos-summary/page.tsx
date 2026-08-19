import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import KasaposSummaryReportClient from './KasaposSummaryReportClient';

export default async function KasaposSummaryReportPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <KasaposSummaryReportClient />;
}
