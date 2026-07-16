import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { ENTEGRASYON_OPTIONS, HAVUZ_ACCOUNT_NAME } from '@/lib/crm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const admin = createPgAdminClient();
  const { data: currentRow, error: currentRowError } = await admin
    .from('musteriler')
    .select('id,musteri,sorumlu')
    .eq('id', musteriId)
    .maybeSingle();

  if (currentRowError) return NextResponse.json({ message: currentRowError.message }, { status: 500 });
  if (!currentRow) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

  // Sorumlu değişikliğinde aktif kullanıcı listesiyle engelleme yapmıyoruz.
  // CRM ekranındaki mevcut/filtrelenmiş sorumlu isimleri veya manuel taşınmış hesaplar kaydedilebilir.

  const requestedOwner = sorumlu || String(currentRow.sorumlu ?? "").trim() || null;
  const actorName = String(me.full_name ?? me.email ?? "").trim() || null;

  const { error } = await admin
    .from('musteriler')
    .update({ musteri, sektor, entegrasyon_tipi, satis_olasiligi, sorumlu: requestedOwner, updated_by: actorName, updated_at: new Date().toISOString() })
    .eq('id', musteriId);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  revalidatePath('/crm/customers');
  return NextResponse.json({ ok: true, message: 'Müşteri kaydı güncellendi.' });
}
