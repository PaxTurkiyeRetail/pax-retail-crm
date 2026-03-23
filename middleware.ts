import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/crm") ||
    pathname.startsWith("/api/crm") ||
    pathname.startsWith("/api/pipeline") ||
    pathname.startsWith("/api/kunye");

  // Cookie adını kontrol et — Supabase session cookie'si sb- ile başlar
  const hasSession = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/crm", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/crm/:path*",
    "/login",
    "/api/crm/:path*",
    "/api/pipeline/:path*",
    "/api/kunye",
  ],
};
