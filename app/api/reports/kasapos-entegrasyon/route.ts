import { NextResponse } from 'next/server';
import { requirePermissionOrThrow, requireReportsAccessOrThrow } from '@/lib/authz';
import { buildKasaposEntegrasyonRaporu, updateAktifSatisKasasi } from '@/lib/reports/kasapos-entegrasyon';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// KasaPOS Entegrasyon Raporu — aylık adet/tutar, kullanım %, satış fırsatı.
export async function GET(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year') ?? '') || undefined;
    const payload = await buildKasaposEntegrasyonRaporu({ year });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'KasaPOS entegrasyon raporu oluşturulamadı.' },
      { status: error?.status || 500 },
    );
  }
}

// Aktif satış kasası girişi — hizmet faturasını giren ekip (sale.create) günceller.
export async function PATCH(request: Request) {
  try {
    await requireReportsAccessOrThrow();
    const user = await requirePermissionOrThrow('sale.create');
    const body = await request.json().catch(() => ({}));
    const customerId = String(body?.customerId ?? '').trim();
    const raw = body?.aktifKasa;
    const value = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) {
      return NextResponse.json({ message: 'Geçersiz firma.' }, { status: 400 });
    }
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100000)) {
      return NextResponse.json({ message: 'Aktif satış kasası 0 veya pozitif tam sayı olmalı.' }, { status: 400 });
    }
    const ok = await updateAktifSatisKasasi(customerId, value, user.full_name || user.email);
    if (!ok) return NextResponse.json({ message: 'Firma bulunamadı.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Aktif satış kasası kaydedilemedi.' },
      { status: error?.status || 500 },
    );
  }
}
