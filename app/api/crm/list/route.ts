import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCrmAccessOrThrow } from "@/lib/authz";
import { isAdminLike } from "@/lib/roles";
import { getKunyeStatus } from "@/lib/kunye";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lite = url.searchParams.get("lite") === "1";

    const supabase = await createSupabaseServerClient();
    const me = await requireCrmAccessOrThrow();

    const myName = (me.full_name ?? "").trim();
    if (!myName) {
      return NextResponse.json(
        { message: "Kullanıcı adı/soyadı boş. allowed_users.full_name doldurulmalı." },
        { status: 400 }
      );
    }

    let query = supabase
      .from("vw_crm_musteriler")
      .select(lite ? "musteri_id,musteri,sorumlu,aktif_faz_no,aktif_faz_adi" : "*")
      .order("musteri", { ascending: true });

    if (!isAdminLike(me.role)) {
      query = query.eq("sorumlu", myName);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = data ?? [];
    const ids = rows.map((row: any) => row.musteri_id).filter(Boolean);
    const kunyeMap = new Map<string, any>();

    if (ids.length > 0) {
      const admin = createSupabaseAdminClient();
      const { data: kunyeler, error: kunyeErr } = await admin
        .from("musteri_kunye")
        .select("musteri_id,firma_adi,magaza_sayisi,toplam_pos_adedi,pos_modeli,erp,bankalar")
        .in("musteri_id", ids);

      if (!kunyeErr || !/relation .* does not exist/i.test(kunyeErr.message)) {
        (kunyeler ?? []).forEach((item: any) => kunyeMap.set(item.musteri_id, item));
      }
    }

    const enriched = rows.map((row: any) => {
      const kunye = kunyeMap.get(row.musteri_id) ?? null;
      const status = getKunyeStatus(kunye);
      return {
        ...row,
        kunye_durumu: status.status,
        kunye_eksik_sayisi: status.missing,
      };
    });

    return NextResponse.json({ rows: enriched });
  } catch (e: any) {
    return NextResponse.json({ message: "Yetkisiz" }, { status: e?.status || 401 });
  }
}