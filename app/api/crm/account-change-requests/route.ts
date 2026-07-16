import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireAdminOrThrow();
    const admin = createPgAdminClient();
    const { data, error } = await admin
      .from('musteri_account_change_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdminOrThrow();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const requestId = String(body.requestId ?? '').trim();
    const action = String(body.action ?? '').trim();
    const note = String(body.note ?? '').trim() || null;
    if (!requestId) return NextResponse.json({ message: 'requestId gerekli' }, { status: 400 });
    if (!['approve', 'reject'].includes(action)) return NextResponse.json({ message: 'Geçersiz aksiyon' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data: row, error: rowError } = await admin
      .from('musteri_account_change_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (rowError) return NextResponse.json({ message: rowError.message }, { status: 500 });
    if (!row) return NextResponse.json({ message: 'Talep bulunamadı.' }, { status: 404 });
    if (row.status !== 'pending') return NextResponse.json({ message: 'Talep zaten işlenmiş.' }, { status: 400 });

    if (action === 'approve') {
      const { error: updateCustomerError } = await admin
        .from('musteriler')
        .update({ sorumlu: row.requested_account })
        .eq('id', row.musteri_id);
      if (updateCustomerError) return NextResponse.json({ message: updateCustomerError.message }, { status: 400 });
    }

    const { error: requestUpdateError } = await admin
      .from('musteri_account_change_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: me.full_name ?? me.email,
        review_note: note,
      })
      .eq('id', requestId);

    if (requestUpdateError) return NextResponse.json({ message: requestUpdateError.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
