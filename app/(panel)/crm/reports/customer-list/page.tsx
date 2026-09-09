import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CustomerListClient from './CustomerListClient';

// Müşteri Listesi (H/F/L/K) — Çağdaş Bey'in kişi bazlı firma dağılımı (Sinan, 09.09.2026).
// Görüntüleme: Raporlar menüsünün kapısı (report.read.all + screen.reports.view).
// Düzenleme yetkisi (customer.assignment_list.manage) payload ile gelir; API ayrıca doğrular.
export default async function CustomerListPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <CustomerListClient />;
}
