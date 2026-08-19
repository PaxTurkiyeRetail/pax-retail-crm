import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// AD-only cutover: parola değiştirme akışı kalıcı olarak kapalı. password_hash
// üzerinde hiçbir güncelleme yapmaz — local erişimin yeniden açılmasına yol açmaz.
export async function POST() {
  return NextResponse.json(
    {
      message: 'Şifre değiştirme kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.',
      error: { code: 'LOCAL_AUTH_DISABLED', message: 'Şifre değiştirme kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.' },
    },
    { status: 410 },
  );
}
