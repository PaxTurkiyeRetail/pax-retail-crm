export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { isMissingRelationError } from '@/lib/quotes/service';
import { normalizeQuoteProduct } from '@/lib/quotes/catalog';

export async function GET() {
  try {
    await requireAllowedUserOrThrow();
    const admin = createPgAdminClient();
    const [{ data: products, error: productErr }, { data: rules, error: ruleErr }] = await Promise.all([
      admin.from('quote_products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      admin.from('quote_pricing_rules').select('*').order('min_qty', { ascending: true }),
    ]);
    if (productErr || ruleErr) {
      if (isMissingRelationError(productErr ?? ruleErr)) return NextResponse.json({ message: 'quote_module_not_setup' }, { status: 400 });
      return NextResponse.json({ message: (productErr ?? ruleErr)?.message || 'Katalog alınamadı.' }, { status: 400 });
    }
    return NextResponse.json({ products: (products ?? []).map((product: any) => normalizeQuoteProduct(product)), rules: rules ?? [] }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
