import { requireReportsAccessOrThrow } from '@/lib/authz';
import SalesRadarPageClient from '@/components/crm/sales-radar/SalesRadarPageClient';

export default async function SalesRadarPage() {
  await requireReportsAccessOrThrow();
  return <SalesRadarPageClient />;
}
