import { notFound } from 'next/navigation';

/**
 * KULLANICI AKTİVİTE SUNUMU — 15.09.2026'dan itibaren KAPALI (Çağdaş Bey).
 * Rapor menüden kaldırıldı ve sayfa herkese (admin ve super_admin dahil) 404 döner.
 * Yetki kontrolüyle değil `notFound()` ile kapatılır: rol/izin değişiklikleri sayfayı geri açmasın.
 * Bileşen (components/reports/UserActivityPresentationClient.tsx), PDF üreteci ve
 * `/api/reports/user-activity-presentation` uçları DURUYOR; yeniden açılacaksa bu dosya geri alınır.
 */
export default async function UserActivityPresentationPage() {
  notFound();
}
