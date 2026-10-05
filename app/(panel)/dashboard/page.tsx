import { requireAllowedUserOrThrow } from '@/lib/authz';
import DashboardOverview from '@/components/reports/DashboardOverview';

// Dashboard (05.10.2026): karne yapısında; her hesap kendi durumunu görür, yönetici tüm ekibi.
// Veri kapsamı API'de süzülür (/api/reports/dashboard). Eski Canlı Ekran: /canli-ekran.
export default async function DashboardPage() {
  await requireAllowedUserOrThrow();
  return <DashboardOverview />;
}