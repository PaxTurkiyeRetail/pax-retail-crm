import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SellerFollowupClient from './SellerFollowupClient';

export default async function SellerFollowupPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <SellerFollowupClient />;
}
