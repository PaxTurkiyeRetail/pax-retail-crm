import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';

type Body = {
  musteriId: string;
  fazNo: number;
  eventType: string;
  notlar: string;
};

export async function POST(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await request.json()) as Body;

    if (!body?.musteriId || !body?.fazNo || !body?.eventType) {
      return NextResponse.json({ error: 'Eksik alan' }, { status: 400 });
    }

    const musteriId = body.musteriId;
    const supabaseUser = createSupabaseServerClient();

    // User ise: müşteri sahipliği kontrol
    if (!isAdminLike(me.role)) {
      const { data: card, error: cardErr } = await supabaseUser
        .from('vw_crm_musteriler')
        .select('musteri_id, sorumlu')
        .eq('musteri_id', musteriId)
        .maybeSingle();

      if (cardErr) return NextResponse.json({ error: cardErr.message }, { status: 500 });
      if (!card) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
      const myName = (me.full_name ?? '').trim();
      if (card.sorumlu !== myName) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();

    // iteration_no: basit default 1 (istersen faz tekrar mantığını ekleriz)
    const { error } = await admin.from('pipeline_eventleri').insert({
      musteri_id: musteriId,
      faz_no: body.fazNo,
      iteration_no: 1,
      event_type: body.eventType,
      notlar: body.notlar ?? null,
      owner: me.email,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: e?.status || 401 });
  }
}
