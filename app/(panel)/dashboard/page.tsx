import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SellerFollowupClient from '../crm/reports/seller-followup/SellerFollowupClient';

// Dashboard (eski dönen pano + sekmeler) geri açıldı (06.10.2026). Yeni tek sayfa görünüm: /canli-ekran.
export default async function DashboardPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <SellerFollowupClient />;
}