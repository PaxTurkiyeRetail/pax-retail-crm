import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import QuickActivityClient from '@/components/activities/QuickActivityClient';
import ActivityHeroDashboard from '@/components/activities/ActivityHeroDashboard';

export default async function NewActivityPage() {
  await requireCrmAccessOrThrow();
  
  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="newActivity" />
      <ActivityHeroDashboard />
      <QuickActivityClient />
    </div>
  );
}
