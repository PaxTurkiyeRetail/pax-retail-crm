import { NextResponse } from 'next/server';
import { getSessionEmailOrNull, requireAdminOrThrow } from '@/lib/authz';
import { approvePairCode, listDevices, revokeDevice } from '@/lib/tv-devices';

export const dynamic = 'force-dynamic';

// TV Cihazları: liste + kodla onay + iptal. Yalnız admin (admin.users.manage).
export async function GET() {
  try {
    await requireAdminOrThrow();
    return NextResponse.json({ devices: await listDevices() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Liste alınamadı.' }, { status: error?.status || 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminOrThrow();
    const actor = (await getSessionEmailOrNull()) ?? 'admin';
    const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string; name?: string; id?: string };
    if (body.action === 'revoke') {
      if (!body.id) return NextResponse.json({ message: 'Cihaz seçilmedi.' }, { status: 400 });
      const ok = await revokeDevice(body.id, actor);
      return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
    }
    const code = String(body.code ?? '');
    if (code.replace(/[^A-Za-z0-9]/g, '').length !== 6) {
      return NextResponse.json({ message: 'Kod 6 karakter olmalı.' }, { status: 400 });
    }
    const id = await approvePairCode(code, String(body.name ?? '').slice(0, 80), actor);
    if (!id) return NextResponse.json({ message: 'Kod geçersiz veya süresi doldu. TV ekranındaki yeni kodu girin.' }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'İşlem yapılamadı.' }, { status: error?.status || 500 });
  }
}
