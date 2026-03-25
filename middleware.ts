import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected =
    pathname.startsWith('/crm') ||
    pathname.startsWith('/api/crm') ||
    pathname.startsWith('/api/pipeline') ||
    pathname.startsWith('/api/kunye');

  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/crm', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/crm/:path*', '/login', '/api/crm/:path*', '/api/pipeline/:path*', '/api/kunye'],
};
