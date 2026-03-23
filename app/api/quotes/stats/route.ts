import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isMissingRelationError } from '@/lib/quotes/service';

export async function GET() {
  try {
    const me = await requireCrmAccessOrThrow();
    const admin = createSupabaseAdminClient();
    let query = admin.from('quotes').select('id,status,total_amount,total_device_count,probability,follow_up_date,valid_until,owner_name');
    if (!isAdminLike(me.role)) query = query.eq('owner_name', String(me.full_name ?? '').trim());
    const { data, error } = await query.limit(5000);
    if (error) {
      if (isMissingRelationError(error)) return NextResponse.json({ onboardingNeeded: true, kpis: null, message: 'quote_module_not_setup' });
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const kpis = {
      total_quotes: rows.length,
      sent_quotes: rows.filter((row: any) => row.status === 'sent').length,
      closed_quotes: rows.filter((row: any) => row.status === 'closed').length,
      overdue_followups: rows.filter((row: any) => row.status !== 'closed' && row.follow_up_date && row.follow_up_date < today).length,
      expiring_soon: rows.filter((row: any) => row.status === 'sent' && row.valid_until && row.valid_until >= today && row.valid_until <= inThreeDays).length,
      total_devices: rows.reduce((sum: number, row: any) => sum + Number(row.total_device_count ?? 0), 0),
      total_amount: rows.reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0),
      weighted_amount: rows.reduce((sum: number, row: any) => sum + (Number(row.total_amount ?? 0) * Number(row.probability ?? 0) / 100), 0),
    };

    return NextResponse.json({ onboardingNeeded: false, kpis });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
