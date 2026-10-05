import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import SellerFollowupClient from '../crm/reports/seller-followup/SellerFollowupClient';

// Eski Dashboard (dönen Canlı Ekran) — 05.10.2026'dan beri /canli-ekran adresinde.
export default async function CanliEkranPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <SellerFollowupClient />;
}