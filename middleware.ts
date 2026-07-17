import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected =
    pathname.startsWith('/crm') ||
    pathname.startsWith('/api/crm') ||
    pathname.startsWith('/api/pipeline') ||
    pathname.startsWith('/api/kunye');

  const hasSessionCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isProtected && !hasSessionCookie) {
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
  matcher: ['/crm/:path*', '/api/crm/:path*', '/api/pipeline/:path*', '/api/kunye'],
};
