import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
    if (fetchSite === 'cross-site' || (origin && origin !== request.nextUrl.origin)) {
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
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Burada yalnızca cookie varlığı doğrulanabilir; geçerliliği DB gerektirir.
  // Geçersiz/bitmiş cookie ile /login <-> /crm yönlendirme döngüsü oluşmaması
  // için login sayfasını middleware seviyesinde CRM'e yönlendirmiyoruz.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pax-logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
