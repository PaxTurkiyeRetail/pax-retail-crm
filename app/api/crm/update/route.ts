import { NextResponse } from 'next/server';
import { isAdminLike, requireCrmAccessOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ENTEGRASYON_OPTIONS, HAVUZ_ACCOUNT_NAME } from '@/lib/crm';

type Body = {
  musteriId?: string;
  musteri?: string;
  sektor?: string | null;
  entegrasyon_tipi?: string | null;
  satis_olasiligi?: string | null;
  sorumlu?: string | null;
};

const allowedEntegrasyon = new Set<string>(ENTEGRASYON_OPTIONS.filter((value) => String(value ?? '').trim().length > 0).map((value) => String(value).trim()));

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
  const satis_olasiligi = body.satis_olasiligi ? String(body.satis_olasiligi).trim() : null;
  const sorumlu = body.sorumlu ? String(body.sorumlu).trim() : null;

  if (entegrasyon_tipi && !allowedEntegrasyon.has(entegrasyon_tipi)) {
    return NextResponse.json({ message: 'Geçersiz entegrasyon tipi.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: currentRow, error: currentRowError } = await admin
    .from('musteriler')
    .select('id,musteri,sorumlu')
    .eq('id', musteriId)
    .maybeSingle();

  if (currentRowError) return NextResponse.json({ message: currentRowError.message }, { status: 500 });
  if (!currentRow) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

  if (sorumlu && sorumlu !== HAVUZ_ACCOUNT_NAME) {
    const { data: allowedUser, error: allowedUserError } = await admin
      .from('allowed_users')
      .select('full_name')
      .eq('is_active', true)
      .eq('full_name', sorumlu)
      .maybeSingle();

    if (allowedUserError) return NextResponse.json({ message: allowedUserError.message }, { status: 500 });
    if (!allowedUser) return NextResponse.json({ message: 'Seçilen sorumlu aktif kullanıcı listesinde bulunamadı.' }, { status: 400 });
  }

  const requestedOwner = sorumlu || String(currentRow.sorumlu ?? '').trim() || null;
  const currentOwner = String(currentRow.sorumlu ?? '').trim() || null;
  const ownerChanged = requestedOwner !== currentOwner;

  if (ownerChanged && !isAdminLike(me.role)) {
    const { data: existingPending, error: existingPendingError } = await admin
      .from('musteri_account_change_requests')
      .select('id')
      .eq('musteri_id', musteriId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPendingError) return NextResponse.json({ message: existingPendingError.message }, { status: 500 });

    if (existingPending?.id) {
      const { error: requestUpdateError } = await admin
        .from('musteri_account_change_requests')
        .update({
          musteri,
          current_account: currentOwner,
          requested_account: requestedOwner,
          requested_by: me.full_name ?? me.email,
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
        })
        .eq('id', existingPending.id);
      if (requestUpdateError) return NextResponse.json({ message: requestUpdateError.message }, { status: 400 });
    } else {
      const { error: requestInsertError } = await admin
        .from('musteri_account_change_requests')
        .insert({
          musteri_id: musteriId,
          musteri,
          current_account: currentOwner,
          requested_account: requestedOwner,
          requested_by: me.full_name ?? me.email,
          status: 'pending',
        });
      if (requestInsertError) return NextResponse.json({ message: requestInsertError.message }, { status: 400 });
    }

    const { error: updateBaseError } = await admin
      .from('musteriler')
      .update({ musteri, sektor, entegrasyon_tipi, satis_olasiligi })
      .eq('id', musteriId);

    if (updateBaseError) return NextResponse.json({ message: updateBaseError.message }, { status: 400 });
    return NextResponse.json({ ok: true, approvalRequired: true, message: 'Sorumlu değişikliği onaya gönderildi.' });
  }

  const { error } = await admin
    .from('musteriler')
    .update({ musteri, sektor, entegrasyon_tipi, satis_olasiligi, sorumlu: requestedOwner })
    .eq('id', musteriId);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: 'Müşteri kaydı güncellendi.' });
}
