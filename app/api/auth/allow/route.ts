import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  return NextResponse.json(
    {
      message: 'Parola ile giriş kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.',
      error: { code: 'LOCAL_AUTH_DISABLED', message: 'Parola ile giriş kalıcı olarak kapatıldı. Kurumsal hesabınızla giriş yapın.' },
    },
    { status: 410 },
  );
}
