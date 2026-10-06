import { requireReportsAccessOrThrow, requireScreenAccessOrThrow } from '@/lib/authz';
import LiveBoard from '@/components/reports/LiveBoard';

// Canlı Ekran (06.10.2026): eski panonun ekranları ve verisi aynen (Genel Özet, kişi kişi, Teklifler, Uyarılar…);
// görünüm Performans Karnesi tasarımında (styles/live-board.css sonundaki "KARNE GÖRÜNÜMÜ").
// Tek sayfa alternatif görünüm: components/reports/CommandCenter.tsx (şu an bağlı değil).
export default async function CanliEkranPage() {
  await requireReportsAccessOrThrow();
  await requireScreenAccessOrThrow('screen.reports.view');
  return <LiveBoard active />;
}