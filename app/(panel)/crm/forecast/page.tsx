import { requireCrmAccessOrThrow } from '@/lib/authz';
import ForecastClient from '@/components/forecast/ForecastClient';

export default async function ForecastPage() {
  await requireCrmAccessOrThrow();
  return (
    <div className="pax-page-container">
      <ForecastClient />
    </div>
  );
}
