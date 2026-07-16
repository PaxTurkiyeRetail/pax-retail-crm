import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { normalizeQuoteSpecs } from '@/lib/quotes/catalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  id?: string;
  code?: string;
  name?: string;
  category?: string;
  product_type?: 'device' | 'bundle' | 'recurring' | 'peripheral';
  unit_label?: string;
  currency?: string;
  is_recurring?: boolean;
  billing_period?: 'one_time' | 'monthly';
  description?: string | null;
  specs?: unknown;
  specsText?: string;
  sort_order?: number;
  is_active?: boolean;
};

export async function POST(request: Request) {
  try {
    await requireAllowedUserOrThrow();
    const body = (await request.json().catch(() => ({}))) as Body;
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    if (!code || !name) return NextResponse.json({ message: 'Kod ve ürün adı zorunlu.' }, { status: 400 });

    const normalizedSpecs = normalizeQuoteSpecs(body.specs ?? body.specsText ?? '');

    const payload = {
      code,
      name,
      category: String(body.category ?? '').trim() || 'EFT POS',
      product_type: body.product_type ?? 'device',
      unit_label: String(body.unit_label ?? '').trim() || 'adet',
      currency: String(body.currency ?? '').trim().toUpperCase() || 'USD',
      is_recurring: Boolean(body.is_recurring),
      billing_period: body.billing_period ?? (body.is_recurring ? 'monthly' : 'one_time'),
      description: String(body.description ?? '').trim() || null,
      specs: JSON.stringify(normalizedSpecs),
      sort_order: Number(body.sort_order ?? 100),
      is_active: body.is_active !== false,
    };

    const admin = createPgAdminClient();
    let query = admin.from('quote_products');
    if (body.id) {
      const { data, error } = await query.update(payload).eq('id', body.id).select('*').single();
      if (error) return NextResponse.json({ message: error.message }, { status: 400 });
      revalidatePath('/crm/quotes/catalog');
      revalidatePath('/crm/quotes/new');
      return NextResponse.json({ ok: true, product: data });
    }

    const { data, error } = await query.insert(payload).select('*').single();
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    revalidatePath('/crm/quotes/catalog');
    revalidatePath('/crm/quotes/new');
    return NextResponse.json({ ok: true, product: data });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
