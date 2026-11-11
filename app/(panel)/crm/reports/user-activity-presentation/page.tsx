import { redirect } from 'next/navigation';

/**
 * KULLANICI AKTİVİTE SUNUMU — 15.09.2026'dan itibaren KAPALI (Çağdaş Bey); menü/katalogda yok.
 * Eski linkler 404 yerine Haftalık Aktivite raporuna yönlenir.
 * Bileşen (components/reports/UserActivityPresentationClient.tsx), PDF üreteci ve
 * `/api/reports/user-activity-presentation` uçları DURUYOR; yeniden açılacaksa bu dosya geri alınır.
 */
export default async function UserActivityPresentationPage() {
  redirect('/crm/reports/weekly-activities');
}
