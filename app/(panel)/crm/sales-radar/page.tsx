import { requireReportsAccessOrThrow, requirePermissionOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SalesRadarPageClient from '@/components/crm/sales-radar/SalesRadarPageClient';

export default async function SalesRadarPage() {
  await requireReportsAccessOrThrow();
  await requirePermissionOrThrow('report.read.all');
  await requireScreenAccessOrThrow('screen.crm.sales_radar.view');
  return <SalesRadarPageClient />;
}
