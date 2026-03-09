import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getKunyeStatus } from '@/lib/kunye';

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const musteriId = String(url.searchParams.get('musteriId') ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: musteri, error } = await admin
      .from('musteriler')
      .select('id,musteri,sektor,entegrasyon_tipi,risk,sorumlu')
      .eq('id', musteriId)
      .maybeSingle();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (!musteri) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

    if (!isAdminLike(me.role) && String(musteri.sorumlu ?? '').trim() !== String(me.full_name ?? '').trim()) {
      return NextResponse.json({ message: 'Bu müşteriyi görüntüleme yetkin yok.' }, { status: 403 });
    }

    const { data: kunye, error: kunyeError } = await admin
      .from('musteri_kunye')
      .select('*')
      .eq('musteri_id', musteriId)
      .maybeSingle();

    if (kunyeError && !/relation .* does not exist/i.test(kunyeError.message)) {
      return NextResponse.json({ message: kunyeError.message }, { status: 500 });
    }

    return NextResponse.json({ musteri, kunye: kunye ?? null, kunyeStatus: getKunyeStatus(kunye ?? null) });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
