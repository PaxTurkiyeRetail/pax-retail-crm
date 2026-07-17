import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionEmailOrNull } from '@/lib/authz';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LoginPage() {
  const sessionEmail = await getSessionEmailOrNull();
  if (sessionEmail) redirect('/crm');

  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
