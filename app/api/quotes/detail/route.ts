import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatMoney, getQuoteDetailById, isMissingRelationError } from '@/lib/quotes/service';

export async function GET(request: Request) {
  try {
    const me = await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const quoteId = String(url.searchParams.get('quoteId') ?? '').trim();
    if (!quoteId) return NextResponse.json({ message: 'quoteId gerekli' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const detail = await getQuoteDetailById(admin, quoteId).catch((error) => {
      if (isMissingRelationError(error)) return null;
      throw error;
    });

    if (!detail) return NextResponse.json({ message: 'Teklif bulunamadı veya quote module setup eksik.' }, { status: 404 });
    if (!isAdminLike(me.role) && String(detail.owner_name ?? '').trim() !== String(me.full_name ?? '').trim()) {
      return NextResponse.json({ message: 'FORBIDDEN' }, { status: 403 });
    }

    const enriched = {
      ...detail,
      formatted_total_amount: formatMoney(Number((detail as any).total_amount ?? 0)),
      formatted_hardware_amount: formatMoney(Number((detail as any).hardware_amount ?? 0)),
      formatted_monthly_amount: formatMoney(Number((detail as any).monthly_amount ?? 0)),
      items: (detail.items ?? []).map((item: any) => ({ ...item, formatted_total_price: formatMoney(Number(item.total_price ?? 0)), formatted_unit_price: formatMoney(Number(item.unit_price ?? 0)) })),
    };

    return NextResponse.json({ quote: enriched });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'İşlem başarısız' }, { status: e?.status || 500 });
  }
}
