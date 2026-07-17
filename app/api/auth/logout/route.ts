import { NextResponse, type NextRequest } from 'next/server';
import { deleteSession } from '@/lib/auth';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: shouldUseSecureAuthCookie(req),
      expires: new Date(0),
      maxAge: 0,
      path: '/',
      priority: 'high',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Çıkış sırasında hata oluştu.' }, { status: 500 });
  }
}
