import { NextResponse, type NextRequest } from 'next/server';
import { shouldUseSecureAuthCookie } from '@/lib/auth-cookie';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';
// lib/auth.ts AUTH_SESSION_TTL_HOURS ile aynı formül (middleware DB'li modülü import edemez).
const SESSION_TTL_HOURS = Math.min(720, Math.max(1, Number(process.env.AUTH_SESSION_TTL_HOURS ?? '720')));

function getPublicOrigin(request: NextRequest) {
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host;
  return `${protocol}://${host}`;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const publicOrigin = getPublicOrigin(request);
  const isApi = pathname.startsWith('/api/');
  const isPublicApi =
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/health' ||
    pathname === '/api/healthz';
  const isPublicPage =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/auth/callback' ||
    pathname === '/manifest.webmanifest';
  const isProtected = (isApi && !isPublicApi) || (!isApi && !isPublicPage);

  const hasSessionCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && hasSessionCookie) {
    const fetchSite = request.headers.get('sec-fetch-site');
    const origin = request.headers.get('origin');
    if (fetchSite === 'cross-site' || (origin && origin !== publicOrigin)) {
      return NextResponse.json(
        { error: { code: 'CSRF_REJECTED', message: 'İstek kaynağı doğrulanamadı.' } },
        { status: 403 },
      );
    }
  }

  if (isProtected && !hasSessionCookie) {
    if (isApi) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Oturum açmanız gerekiyor.' } },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/login', publicOrigin);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Burada yalnızca cookie varlığı doğrulanabilir; geçerliliği DB gerektirir.
  // Geçersiz/bitmiş cookie ile /login <-> /crm yönlendirme döngüsü oluşmaması
  // için login sayfasını middleware seviyesinde CRM'e yönlendirmiyoruz.
  const response = NextResponse.next();

  // Kayan oturum: sayfa gezildikçe cookie ömrü yenilenir (DB tarafı lib/auth.ts'de uzar).
  // Böylece aynı cihazda aktif kullanan kullanıcıdan tekrar AD şifresi istenmez.
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (sessionCookie && !isApi && request.method === 'GET') {
    response.cookies.set(AUTH_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: shouldUseSecureAuthCookie(request),
      sameSite: 'lax',
      maxAge: SESSION_TTL_HOURS * 60 * 60,
      path: '/',
      priority: 'high',
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pax-logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
