import { NextResponse } from "next/server";
import { createPgServerClient } from "@/lib/pg/server";
import { requireCrmAccessOrThrow } from "@/lib/authz";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const musteriId = url.searchParams.get("musteriId");
    if (!musteriId) return NextResponse.json({ error: "musteriId gerekli" }, { status: 400 });

    const me = await requireCrmAccessOrThrow();
    const pgClient = await createPgServerClient();

    const { data, error } = await pgClient
      .from("vw_crm_timeline")
      .select("*")
      .eq("musteri_id", musteriId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: e?.status || 401 });
  }
}
