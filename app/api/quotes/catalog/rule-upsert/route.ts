import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  product_id?: string;
  min_qty?: number;
  max_qty?: number | null;
  unit_price?: number;
};

export async function POST(request: Request) {
  try {
    await requireAdminOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const productId = String(body.product_id ?? '').trim();
    const minQty = Number(body.min_qty ?? 0);
    const maxQty = body.max_qty == null ? null : Number(body.max_qty);
    const unitPrice = Number(body.unit_price ?? NaN);

    if (!productId) return NextResponse.json({ message: 'product_id gerekli.' }, { status: 400 });
    if (!Number.isFinite(minQty) || minQty <= 0) return NextResponse.json({ message: 'Min adet 1 veya büyük olmalı.' }, { status: 400 });
    if (maxQty != null && (!Number.isFinite(maxQty) || maxQty < minQty)) return NextResponse.json({ message: 'Max adet min adetten küçük olamaz.' }, { status: 400 });
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ message: 'Birim fiyat geçersiz.' }, { status: 400 });

    const admin = createPgAdminClient();
    const { data: existing } = await admin
      .from('quote_pricing_rules')
      .select('id')
      .eq('product_id', productId)
      .eq('min_qty', minQty)
      .is('max_qty', maxQty)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await admin.from('quote_pricing_rules').update({ unit_price: unitPrice }).eq('id', existing.id).select('*').single();
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, rule: data });
    }

    const { data, error } = await admin.from('quote_pricing_rules').insert({
      product_id: productId,
      min_qty: minQty,
      max_qty: maxQty,
      unit_price: unitPrice,
    }).select('*').single();

    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, rule: data });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
