import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { rule_id?: string };

export async function POST(request: Request) {
  try {
    await requireAdminOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const ruleId = String(body.rule_id ?? '').trim();
    if (!ruleId) return NextResponse.json({ message: 'rule_id gerekli.' }, { status: 400 });
    const admin = createPgAdminClient();
    const { error } = await admin.from('quote_pricing_rules').delete().eq('id', ruleId);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
