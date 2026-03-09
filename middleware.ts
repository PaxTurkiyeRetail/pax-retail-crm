import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    path?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    sameSite?: "lax" | "strict" | "none" | boolean;
    secure?: boolean;
    priority?: "low" | "medium" | "high";
  };
};

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isProtected =
      pathname.startsWith("/crm") ||
      pathname.startsWith("/api/crm") ||
      pathname.startsWith("/api/pipeline") ||
      pathname.startsWith("/api/kunye");

    if (isProtected && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname + search);
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/crm", request.url));
    }

    return response;
  } catch {
    return response;
  }
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