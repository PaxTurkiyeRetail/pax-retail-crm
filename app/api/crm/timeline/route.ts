import { NextResponse } from "next/server";
import { createPgServerClient } from "@/lib/pg/server";
import { assertOwnedResourceAccess, requireCrmAccessOrThrow } from "@/lib/authz";
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const musteriId = url.searchParams.get("musteriId");
    if (!musteriId) return NextResponse.json({ error: "musteriId gerekli" }, { status: 400 });

    const me = await requireCrmAccessOrThrow();
    const pgClient = await createPgServerClient();
    const admin = createPgAdminClient();
    const { data: customer } = await admin.from('musteriler').select('owner_user_id,sorumlu').eq('id', musteriId).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });
    assertOwnedResourceAccess({ user: me, resource: customer, ownPermission: 'customer.read', anyPermission: 'customer.read.any' });

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
