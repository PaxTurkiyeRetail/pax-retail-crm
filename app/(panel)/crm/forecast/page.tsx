import { requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import ForecastClient from '@/components/forecast/ForecastClient';
import '@/styles/forecast-compact.css';

export default async function ForecastPage() {
  await requirePermissionOrThrow('forecast.read');
  await requireScreenAccessOrThrow('screen.crm.forecast.view');
  return (
    <div className="pax-page-container">
      <ForecastClient />
    </div>
  );
}
