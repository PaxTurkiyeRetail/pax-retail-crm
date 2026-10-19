import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import RetailOperasyonClient from './RetailOperasyonClient';

export default async function RetailOperasyonPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <RetailOperasyonClient />;
}
