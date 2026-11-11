import { redirect } from 'next/navigation';

/**
 * SATICI ÖZETİ — 15.09.2026'dan itibaren KAPALI (Çağdaş Bey); menü/katalogda yok.
 * Eski linkler 404 yerine Satıcı Takip raporuna yönlenir.
 * İstemci bileşeni (SellerSummaryClient.tsx) ve `/api/reports/seller-summary` ucu DURUYOR —
 * uç Genel Bakış panosunu besliyor. Yeniden açılacaksa bu dosyayı eski hâline getirmek yeter.
 */
export default async function SellerSummaryPage() {
  redirect('/crm/reports/seller-followup');
}
