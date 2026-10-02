import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import KasaposEntegrasyonClient from './KasaposEntegrasyonClient';

export default async function KasaposEntegrasyonPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <KasaposEntegrasyonClient />;
}
