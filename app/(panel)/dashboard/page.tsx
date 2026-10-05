import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SellerFollowupClient from '../crm/reports/seller-followup/SellerFollowupClient';

// Dashboard'un kalıcı adresi (05.10.2026). Eski /crm/reports/seller-followup buraya yönlenir.
export default async function DashboardPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <SellerFollowupClient />;
}
