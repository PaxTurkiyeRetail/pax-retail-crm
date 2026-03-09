import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookies().getAll();
      },
      setAll(cookiesToSet) {
        const c = cookies();
        cookiesToSet.forEach(({ name, value, options }) => c.set(name, value, options));
      },
    },
  });
}
