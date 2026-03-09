import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const musteriId = url.searchParams.get('musteriId');
    if (!musteriId) return NextResponse.json({ error: 'musteriId gerekli' }, { status: 400 });

    const me = await requireCrmAccessOrThrow();
    const supabase = createSupabaseServerClient();

    // User ise: önce müşterinin sorumlusu kontrol.
    if (!isAdminLike(me.role)) {
      const { data: card, error: cardErr } = await supabase
        .from('vw_crm_musteriler')
        .select('musteri_id, sorumlu')
        .eq('musteri_id', musteriId)
        .maybeSingle();

      if (cardErr) return NextResponse.json({ error: cardErr.message }, { status: 500 });
      if (!card) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

      const myName = (me.full_name ?? '').trim();
      if (card.sorumlu !== myName) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('vw_crm_timeline')
      .select('*')
      .eq('musteri_id', musteriId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: e?.status || 401 });
  }
}
