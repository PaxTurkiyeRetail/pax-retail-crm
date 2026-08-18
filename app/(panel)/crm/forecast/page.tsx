import { requirePermissionOrThrow } from '@/lib/authz';
import ForecastClient from '@/components/forecast/ForecastClient';

export default async function ForecastPage() {
  await requirePermissionOrThrow('forecast.read');
  return (
    <div className="pax-page-container">
      <ForecastClient />
    </div>
  );
}
