import { redirect } from 'next/navigation';

// Ayrı Canlı Ekran sayfası 13.10.2026'da kaldırıldı; yer imleri Dashboard'a düşer.
export default function CanliEkranPage() {
  redirect('/dashboard');
}
