import { NextResponse } from "next/server";
import { requireCrmAccessOrThrow } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ENTEGRASYON_OPTIONS, HAVUZ_ACCOUNT_NAME } from '@/lib/crm';

type Body = {
  musteri?: string;
  sektor?: string | null;
  entegrasyon_tipi?: string | null;
  satis_olasiligi?: string | null;
  sorumlu?: string | null;
};

const allowedEntegrasyon = new Set(ENTEGRASYON_OPTIONS.filter(Boolean));

export async function POST(req: Request) {
  let me: Awaited<ReturnType<typeof requireCrmAccessOrThrow>>;
  try {
    me = await requireCrmAccessOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: "Yetkisiz" }, { status: e?.status || 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const musteri = (body.musteri ?? "").trim();
  if (!musteri) return NextResponse.json({ message: "musteri gerekli" }, { status: 400 });

  const sektor = body.sektor ? String(body.sektor).trim() : null;
  const entegrasyon_tipi = body.entegrasyon_tipi ? String(body.entegrasyon_tipi).trim() : null;
  const satis_olasiligi = body.satis_olasiligi ? String(body.satis_olasiligi).trim() : null;

  if (entegrasyon_tipi && !allowedEntegrasyon.has(entegrasyon_tipi)) {
    return NextResponse.json({ message: "Geçersiz entegrasyon tipi." }, { status: 400 });
  }

  const myName = (me.full_name ?? "").trim();
  if (!myName) {
    return NextResponse.json({ message: "Kullanıcı adı/soyadı boş. allowed_users.full_name doldurulmalı." }, { status: 400 });
  }

  const sorumlu = (body.sorumlu ?? '').trim() || myName;
  const admin = createSupabaseAdminClient();

  if (sorumlu !== HAVUZ_ACCOUNT_NAME) {
    const { data: allowedUser, error: allowedUserError } = await admin
      .from("allowed_users")
      .select("full_name")
      .eq("is_active", true)
      .eq("full_name", sorumlu)
      .maybeSingle();

    if (allowedUserError) return NextResponse.json({ message: allowedUserError.message }, { status: 500 });
    if (!allowedUser) return NextResponse.json({ message: "Seçilen sorumlu aktif kullanıcı listesinde bulunamadı." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("musteriler")
    .insert({ musteri, sektor, entegrasyon_tipi, satis_olasiligi, sorumlu })
    .select("id")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data?.id });
}
