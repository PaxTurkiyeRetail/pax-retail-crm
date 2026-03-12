import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getKunyeStatus, normalizeKunyePayload } from '@/lib/kunye';

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const musteriId = String(url.searchParams.get('musteriId') ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: musteri, error: musteriErr } = await admin
      .from('musteriler')
      .select('id,sorumlu')
      .eq('id', musteriId)
      .maybeSingle();

    if (musteriErr) return NextResponse.json({ message: musteriErr.message }, { status: 500 });
    if (!musteri) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });
    if (!isAdminLike(me.role) && String(musteri.sorumlu ?? '').trim() !== String(me.full_name ?? '').trim()) {
      return NextResponse.json({ message: 'Bu müşteriyi görüntüleme yetkin yok.' }, { status: 403 });
    }

    const { data, error } = await admin.from('musteri_kunye').select('*').eq('musteri_id', musteriId).maybeSingle();
    if (error && !/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ kunye: data ?? null, status: getKunyeStatus(data ?? null) });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const musteriId = String(body.musteriId ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: musteri, error: musteriErr } = await admin
      .from('musteriler')
      .select('id,sorumlu')
      .eq('id', musteriId)
      .maybeSingle();

    if (musteriErr) return NextResponse.json({ message: musteriErr.message }, { status: 500 });
    if (!musteri) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });
    if (!isAdminLike(me.role) && String(musteri.sorumlu ?? '').trim() !== String(me.full_name ?? '').trim()) {
      return NextResponse.json({ message: 'Bu müşteriyi düzenleme yetkin yok.' }, { status: 403 });
    }

    const payload = normalizeKunyePayload(body);
    const record = { musteri_id: musteriId, ...payload, updated_by: me.full_name ?? me.email };

    const { error } = await admin.from('musteri_kunye').upsert(record, { onConflict: 'musteri_id' });
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, status: getKunyeStatus(payload) });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
