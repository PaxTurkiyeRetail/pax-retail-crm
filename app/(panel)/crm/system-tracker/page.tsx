import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemTrackerClient from '@/components/system/SystemTrackerClient';

export default async function SystemTrackerPage() {
  await requireCrmAccessOrThrow();
  return <SystemTrackerClient />;
}
