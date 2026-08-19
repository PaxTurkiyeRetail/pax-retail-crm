import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// AD-only cutover: local password login kalıcı olarak kapalı. Bu route hiçbir
// koşulda session oluşturmaz veya başka bir auth metoduna fallback etmez —
// yalnız kurumsal (Entra) giriş kullanılır: /api/auth/oidc/start.
export async function POST() {
  return NextResponse.json(
    {
      message: 'Parola ile giriş kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.',
      error: { code: 'LOCAL_AUTH_DISABLED', message: 'Parola ile giriş kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.' },
    },
    { status: 410 },
  );
}
