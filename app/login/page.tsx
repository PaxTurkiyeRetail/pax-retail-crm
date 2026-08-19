import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionEmailOrNull } from '@/lib/authz';
import LoginClient from './LoginClient';
import { getSystemParameterBoolean } from '@/lib/system-parameters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LoginPage() {
  const sessionEmail = await getSessionEmailOrNull();
  if (sessionEmail) redirect('/crm');
  const oidcEnabled = process.env.NEXT_PUBLIC_OIDC_ENABLED === 'true'
    && await getSystemParameterBoolean('system_oidc_enabled', false);

  return (
    <Suspense fallback={null}>
      <LoginClient oidcEnabled={oidcEnabled} />
    </Suspense>
  );
}
