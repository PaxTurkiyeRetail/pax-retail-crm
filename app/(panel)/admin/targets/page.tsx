import { requireScreenAccessOrThrow, requireTargetsAccessOrThrow } from '@/lib/authz';
import TargetsClient from './TargetsClient';

// Hedefler — Çağdaş Bey (10.09.2026): kişi bazlı satış hedeflerini Admin / Super Admin
// ayrı bir ekrandan girer; satışçılar bu ekranı görmez. Canlı Ekran kişi slaytındaki
// donut'lar (haftalık aktivite · çeyrek/yıl ziyaret · yıl/çeyrek bütçe · entegrasyon ·
// H→F / L→H çevirme · kazanılan teklif) buradan beslenir.
// Kapı: admin.targets.manage + screen.admin.targets.view (migration 026: admin, super_admin).
export default async function TargetsPage() {
  await requireTargetsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.admin.targets.view');
  return <TargetsClient />;
}
