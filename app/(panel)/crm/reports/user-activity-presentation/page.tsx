import { requireAdminOrThrow } from '@/lib/authz';
import { getActivityReportMeta, listActivityReportUsers } from '@/lib/user-activity-presentation';
import UserActivityPresentationClient from '@/components/reports/UserActivityPresentationClient';

export default async function UserActivityPresentationPage() {
  await requireAdminOrThrow();
  const [users, meta] = await Promise.all([
    listActivityReportUsers(),
    getActivityReportMeta(),
  ]);
  return <UserActivityPresentationClient users={users} meta={meta} />;
}
