import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// AD-only cutover: parola sıfırlama akışı kalıcı olarak kapalı. Token
// üretmez, mail göndermez — local erişimin yeniden açılmasına yol açmaz.
export async function POST() {
  return NextResponse.json(
    {
      message: 'Şifre sıfırlama kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.',
      error: { code: 'LOCAL_AUTH_DISABLED', message: 'Şifre sıfırlama kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.' },
    },
    { status: 410 },
  );
}
