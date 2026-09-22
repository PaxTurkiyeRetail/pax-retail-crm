import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import YilZiyaretPortfoyClient from './YilZiyaretPortfoyClient';

export default async function YilZiyaretPortfoyPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <YilZiyaretPortfoyClient />;
}
