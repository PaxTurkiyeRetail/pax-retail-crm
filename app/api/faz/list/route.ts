import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAllowedUserOrThrow } from '@/lib/authz';

export async function GET() {
  try {
    await requireAllowedUserOrThrow();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('faz_tanimlari')
      .select('faz_no, asama_adi')
      .order('faz_no', { ascending: true });

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ fazlar: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
