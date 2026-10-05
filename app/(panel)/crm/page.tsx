import CrmDashboardClient from '@/components/crm/CrmDashboardClient';
import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow, userHasPermission } from '@/lib/authz';

export default async function CrmPage() {
  const user = await requireAllowedUserOrThrow();
  // Açılış ekranı Dashboard (02.10.2026): rapor yetkisi olan herkes oraya düşer.
  if (userHasPermission(user, 'report.read.all') && userHasPermission(user, 'screen.reports.view')) {
    redirect('/canli-ekran');
  }
  // screen.crm.dashboard.view yoksa throw etmek yerine kullanıcının erişebildiği
  // ilk ekrana yönlendir — login sonrası herkes varsayılan olarak /crm'e düşüyor,
  // dashboard yetkisi olmayan rol (ör. user) burada patlamamalı.
  if (!userHasPermission(user, 'screen.crm.dashboard.view')) {
    if (userHasPermission(user, 'request.read.own') || userHasPermission(user, 'request.read.all') || userHasPermission(user, 'request.create')) redirect('/requests');
    redirect('/login');
  }
  if (!userHasPermission(user, 'customer.read')) {
    if (userHasPermission(user, 'request.read.own') || userHasPermission(user, 'request.read.all') || userHasPermission(user, 'request.create')) redirect('/requests');
    redirect('/login');
  }
  return <CrmDashboardClient />;
}
