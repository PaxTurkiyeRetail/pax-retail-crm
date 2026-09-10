import { requireCrmAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import CustomerListClient from './CustomerListClient';

// Müşteri Listesi (H/F/L/K) — Çağdaş Bey'in kişi bazlı firma dağılımı (Sinan, 09.09.2026).
// Operasyon menüsünde, Müşteriler'in yanında (Sinan, 10.09: "raporlar değil operasyon kırılımı").
// Görüntüleme: Müşteriler ekranıyla aynı kapı (customer.read + screen.crm.customers.view).
// Düzenleme yetkisi (customer.assignment_list.manage) payload ile gelir; API ayrıca doğrular.
export default async function CustomerListPage() {
  await requireCrmAccessOrThrow();
  await requireScreenAccessOrThrow('screen.crm.customers.view');
  return <CustomerListClient />;
}
