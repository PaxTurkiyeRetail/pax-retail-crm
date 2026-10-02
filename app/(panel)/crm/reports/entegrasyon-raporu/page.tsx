import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import EntegrasyonRaporuTabs from './EntegrasyonRaporuTabs';

export default async function EntegrasyonRaporuPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <EntegrasyonRaporuTabs />;
}
