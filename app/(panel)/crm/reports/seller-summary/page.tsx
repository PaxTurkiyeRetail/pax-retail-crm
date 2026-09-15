import { notFound } from 'next/navigation';

/**
 * SATICI ÖZETİ — 15.09.2026'dan itibaren KAPALI (Çağdaş Bey).
 * Rapor menüden kaldırıldı ve sayfa herkese (admin ve super_admin dahil) 404 döner;
 * ses kaydındaki "sadece admin'e aç" kararı sonradan "tamamen gizlensin"e döndü (Sinan teyit etti).
 * Yetki kontrolüyle değil `notFound()` ile kapatılır: rol/izin değişiklikleri sayfayı geri açmasın.
 * Ekranın istemci bileşeni (SellerSummaryClient.tsx) ve `/api/reports/seller-summary` ucu DURUYOR —
 * uç Genel Bakış panosunu besliyor. Yeniden açılacaksa bu dosyayı eski hâline getirmek yeter.
 */
export default async function SellerSummaryPage() {
  notFound();
}
