import { requireActivityReadOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import ActivitiesDashboardClient from './ActivitiesDashboardClient';

export default async function ActivitiesPage() {
  await requireActivityReadOrThrow();
  await requireScreenAccessOrThrow('screen.crm.activities.view');
  return <ActivitiesDashboardClient />;
}
