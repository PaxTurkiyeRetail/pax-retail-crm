import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import PerformanceCard from '@/components/reports/PerformanceCard';

// PERFORMANS KARNESİ (05.10.2026) — ayrı birime açılan ekran; Dashboard'dan bağımsız.
// Yalnız admin + super_admin rolü görür (menü de aynı kuralla gizlenir, bkz. PanelShell).
export default async function PerformanceCardPage() {
  const user = await requireAllowedUserOrThrow();
  if (!isAdminLike(user.role)) redirect('/dashboard');
  return <PerformanceCard active />;
}
