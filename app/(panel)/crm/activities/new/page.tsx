import { requireActivityCreateOrThrow } from '@/lib/authz';
import QuickActivityClient from '@/components/activities/QuickActivityClient';
import ActivityHeroDashboard from '@/components/activities/ActivityHeroDashboard';

export default async function NewActivityPage() {
  await requireActivityCreateOrThrow();
  
  return (
    <div className="pax-page-container">
      <ActivityHeroDashboard />
      <QuickActivityClient />
    </div>
  );
}
