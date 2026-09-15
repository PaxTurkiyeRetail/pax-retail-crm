import { redirect } from 'next/navigation';

/**
 * FAZ RAPORU — 15.09.2026'dan itibaren Satışçı Takip Raporu'nun **sekmesi** (Çağdaş Bey:
 * "Faz Raporu dashboard'un içine gömülsün"). Ayrı ekran kalmadı; eski adres ve yer imleri
 * bozulmasın diye sekmeye yönlendirilir. Ekran kodu PhaseReportClient.tsx'te durur ve
 * oradan `embedded` modunda çağrılır.
 */
export default async function PhaseReportPage() {
  redirect('/crm/reports/seller-followup?tab=faz');
}
