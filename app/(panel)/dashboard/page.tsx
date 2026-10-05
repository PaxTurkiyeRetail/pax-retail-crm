import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { userHasPermission } from '@/lib/permissions';

// Dashboard (05.10.2026): müdür kararıyla şimdilik kapalı — Performans Karnesi yeterli.
// Kod duruyor (components/reports/DashboardOverview.tsx); eski adres Canlı Ekran'a / Genel Bakış'a düşer.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAllowedUserOrThrow();
  if (!userHasPermission(user, 'report.read.all') || !userHasPermission(user, 'screen.reports.view')) redirect('/crm');
  const tab = (await searchParams).tab;
  redirect(typeof tab === 'string' ? `/canli-ekran?tab=${encodeURIComponent(tab)}` : '/canli-ekran');
}