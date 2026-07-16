import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getKunyeStatus, mapKunyeDbToUi, mapKunyeUiToDb, normalizeKunyePayload } from '@/lib/kunye';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getCustomer(admin: ReturnType<typeof createPgAdminClient>, musteriId: string) {
  const { data, error } = await admin
    .from('musteriler')
    .select('id,musteri,sektor,sorumlu')
    .eq('id', musteriId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: Request) {
  try {
    await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const musteriId = String(url.searchParams.get('musteriId') ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const admin = createPgAdminClient();
    const musteri = await getCustomer(admin, musteriId);
    if (!musteri) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

    if (isReportOnlyCustomer(musteri)) {
      return NextResponse.json({
        kunye: null,
        status: { status: 'Kapsam Dışı', missing: 0, total: 0, missingFields: [] },
        kunyeDisabled: true,
        message: 'Bu müşteri İş Ortağı kapsamındadır; künye açılmaz.',
      });
    }

    const { data, error } = await admin
      .from('v_musteri_kunye_status')
      .select('*')
      .eq('musteri_id', musteriId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { message: `v_musteri_kunye_status view bulunamadı veya okunamadı: ${error.message}` },
        { status: 500 },
      );
    }

    const mappedKunye = mapKunyeDbToUi({
      ...data,
      firma_adi: data?.firma_adi ?? musteri.musteri ?? null,
    });

    return NextResponse.json({
      kunye: mappedKunye,
      status: getKunyeStatus({
        ...mappedKunye,
        ...(data ?? {}),
        firma_adi: mappedKunye?.firma_adi ?? musteri.musteri ?? null,
        has_kunye_record: Boolean(mappedKunye?.has_kunye_record),
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const musteriId = String(body.musteriId ?? '').trim();
    if (!musteriId) return NextResponse.json({ message: 'musteriId gerekli' }, { status: 400 });

    const admin = createPgAdminClient();
    const musteri = await getCustomer(admin, musteriId);
    if (!musteri) return NextResponse.json({ message: 'Müşteri bulunamadı.' }, { status: 404 });

    if (isReportOnlyCustomer(musteri)) {
      return NextResponse.json(
        { message: 'Bu müşteri İş Ortağı kapsamındadır; künye kaydı açılamaz.' },
        { status: 409 },
      );
    }

    const payload = normalizeKunyePayload({
      ...body,
      firma_adi: String(body.firma_adi ?? musteri.musteri ?? ''),
    });

    const record = {
      musteri_id: musteriId,
      ...mapKunyeUiToDb(payload),
      updated_by: String(me.full_name ?? me.email ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from('musteri_kunye_v2').upsert(record, { onConflict: 'musteri_id' });
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    revalidatePath(`/crm/${musteriId}`);
    revalidatePath('/crm');
    revalidatePath('/crm/customers');

    return NextResponse.json({
      ok: true,
      status: getKunyeStatus({
        ...payload,
        firma_adi: musteri.musteri,
        has_kunye_record: true,
      }),
    });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
