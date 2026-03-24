import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Supabase şifre sıfırlama linklerinde type=recovery gelir
  const type = url.searchParams.get("type");
  // next parametresi varsa oraya yönlendir (magic link vb.)
  const next = url.searchParams.get("next") ?? "/crm";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Sadece şifre sıfırlama (recovery) akışında reset-password sayfasına git
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", url.origin));
  }

  // Diğer tüm durumlarda (magic link, email confirm vb.) normal akışa dön
  const redirectTo = next.startsWith("/") ? next : "/crm";
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}