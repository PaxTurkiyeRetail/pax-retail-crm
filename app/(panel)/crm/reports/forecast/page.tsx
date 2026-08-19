import { requireReportsAccessOrThrow, requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import ForecastReportClient from '@/components/forecast/ForecastReportClient';

export default async function ForecastReportPage() {
  await requireReportsAccessOrThrow();
  await requirePermissionOrThrow('report.read.all');
  await requireScreenAccessOrThrow('screen.reports.view');
  return (
    <div className="pax-page-container">
      <ForecastReportClient />
    </div>
  );
}
