export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import PanelShell from '@/components/PanelShell';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requireAllowedUserOrThrow>>;
  try { user = await requireAllowedUserOrThrow(); } catch { redirect('/login'); }
  return <PanelShell role={user.role} fullName={user.full_name} email={user.email}>{children}</PanelShell>;
}
