import { redirect } from 'next/navigation';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import PanelShell from '@/components/PanelShell';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof requireAllowedUserOrThrow>>;

  try {
    user = await requireAllowedUserOrThrow();
  } catch {
    redirect('/login');
  }

  return <PanelShell role={user.role}>{children}</PanelShell>;
}
