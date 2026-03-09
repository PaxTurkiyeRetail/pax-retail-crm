import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type Body = {
  musteriId?: string;
  musteri?: string;
  sektor?: string | null;
  entegrasyon_tipi?: string | null;
  risk?: string | null;
  sorumlu?: string | null;
};

const allowedEntegrasyon = new Set(['A2A', 'D2D', 'D2D+A2A']);

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireCrmAccessOrThrow>>;
  try {
    me = await requireCrmAccessOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const musteriId = String(body.musteriId ?? '').trim();
  if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

  const musteri = String(body.musteri ?? '').trim();
  if (!musteri) return NextResponse.json({ message: 'musteri gerekli' }, { status: 400 });

  const sektor = body.sektor ? String(body.sektor).trim() : null;
  const entegrasyon_tipi = body.entegrasyon_tipi ? String(body.entegrasyon_tipi).trim() : null;
  const risk = body.risk ? String(body.risk).trim() : null;
  const sorumlu = body.sorumlu ? String(body.sorumlu).trim() : null;

  if (entegrasyon_tipi && !allowedEntegrasyon.has(entegrasyon_tipi)) {
    return NextResponse.json({ message: 'Geçersiz entegrasyon tipi.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  if (!isAdminLike(me.role)) {
    const { data: ownRow, error: ownErr } = await admin
      .from('musteriler')
      .select('sorumlu')
      .eq('id', musteriId)
      .maybeSingle();

    if (ownErr) return NextResponse.json({ message: ownErr.message }, { status: 500 });
    if (!ownRow) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });
    if (String(ownRow.sorumlu ?? '').trim() !== String(me.full_name ?? '').trim()) {
      return NextResponse.json({ message: 'Bu müşteriyi düzenleme yetkin yok.' }, { status: 403 });
    }
  }

  if (sorumlu) {
    const { data: allowedUser, error: allowedUserError } = await admin
      .from('allowed_users')
      .select('full_name')
      .eq('is_active', true)
      .eq('full_name', sorumlu)
      .maybeSingle();

    if (allowedUserError) return NextResponse.json({ message: allowedUserError.message }, { status: 500 });
    if (!allowedUser) return NextResponse.json({ message: 'Seçilen sorumlu aktif kullanıcı listesinde bulunamadı.' }, { status: 400 });
  }

  const { error } = await admin
    .from('musteriler')
    .update({ musteri, sektor, entegrasyon_tipi, risk, sorumlu })
    .eq('id', musteriId);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
