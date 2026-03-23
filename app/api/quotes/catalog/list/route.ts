import { NextResponse } from 'next/server';
import { requireAdminOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isMissingRelationError } from '@/lib/quotes/service';

export async function GET() {
  try {
    await requireAdminOrThrow();
    const admin = createSupabaseAdminClient();
    const [{ data: products, error: productErr }, { data: rules, error: ruleErr }] = await Promise.all([
      admin.from('quote_products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      admin.from('quote_pricing_rules').select('*').order('min_qty', { ascending: true }),
    ]);
    if (productErr || ruleErr) {
      if (isMissingRelationError(productErr ?? ruleErr)) return NextResponse.json({ message: 'quote_module_not_setup' }, { status: 400 });
      return NextResponse.json({ message: (productErr ?? ruleErr)?.message || 'Katalog alınamadı.' }, { status: 400 });
    }
    return NextResponse.json({ products: products ?? [], rules: rules ?? [] });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
