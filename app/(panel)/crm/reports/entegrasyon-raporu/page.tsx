import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import EntegrasyonRaporuClient from './EntegrasyonRaporuClient';

export default async function EntegrasyonRaporuPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <EntegrasyonRaporuClient />;
}
