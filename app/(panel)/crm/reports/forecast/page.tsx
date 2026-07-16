import { requireReportsAccessOrThrow } from '@/lib/authz';
import ForecastReportClient from '@/components/forecast/ForecastReportClient';

export default async function ForecastReportPage() {
  await requireReportsAccessOrThrow();
  return (
    <div className="pax-page-container">
      <ForecastReportClient />
    </div>
  );
}
