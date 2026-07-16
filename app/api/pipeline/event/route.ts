import { NextResponse } from "next/server";
import { createPgAdminClient } from "@/lib/pg/admin";
import { requireCrmAccessOrThrow } from "@/lib/authz";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
    }

    const admin = createPgAdminClient();
    const actor = String(me.full_name ?? me.email ?? "").trim() || null;

    const { error } = await admin.from("pipeline_eventleri").insert({
      musteri_id: body.musteriId,
      faz_no: body.fazNo,
      iteration_no: 1,
      event_type: body.eventType,
      notlar: body.notlar ?? null,
      owner: me.email,
      created_by: actor,
      created_by_user_id: me.id,
      created_by_email: me.email,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: e?.status || 401 });
  }
}
