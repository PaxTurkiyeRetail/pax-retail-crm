import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEFAULT_AUTH_ROUTE = process.env.APP_DEFAULT_AUTH_ROUTE || '/crm';
const DEFAULT_GUEST_ROUTE = process.env.APP_DEFAULT_GUEST_ROUTE || '/login';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? DEFAULT_AUTH_ROUTE : DEFAULT_GUEST_ROUTE);
}
