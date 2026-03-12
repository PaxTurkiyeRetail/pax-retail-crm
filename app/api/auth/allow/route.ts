import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ message: 'Email gerekli' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('allowed_users')
    .select('email, is_active')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }

  if (!data || !data.is_active) {
    return NextResponse.json({ message: 'Bu email ile giriş yetkin yok.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
