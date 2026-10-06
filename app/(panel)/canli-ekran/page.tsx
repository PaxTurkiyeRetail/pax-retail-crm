import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CommandCenter from '@/components/reports/CommandCenter';

// Canlı Ekran (05.10.2026): dönen slaytlar ve sekmeler kalktı; takım durumu tek sayfada, karne tasarımında.
// Eski pano kodu (SellerFollowupClient / LiveBoard) duruyor, artık bağlı değil.
export default async function CanliEkranPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <CommandCenter />;
}