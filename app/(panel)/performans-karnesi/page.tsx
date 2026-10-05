import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { userHasPermission } from '@/lib/permissions';
import PerformanceCard from '@/components/reports/PerformanceCard';

// PERFORMANS KARNESİ (05.10.2026) — ayrı birime açılan ekran; Dashboard'dan bağımsız.
// Kapı: screen.reports.performance.view + report.performance.read (admin + super_admin; RBAC'tan
// yönetilir). API de aynı izni ayrıca kontrol eder. Menü aynı kuralla gizlenir (PanelShell).
export default async function PerformanceCardPage() {
  const user = await requireAllowedUserOrThrow();
  if (!userHasPermission(user, 'screen.reports.performance.view') || !userHasPermission(user, 'report.performance.read')) redirect('/dashboard');
  return <PerformanceCard />;
}
