import { NextResponse } from 'next/server';
import { assertOwnedResourceAccess, requireActivityReadOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const me = await requireActivityReadOrThrow();
    const url = new URL(req.url);
    const musteriId = url.searchParams.get('musteri_id')?.trim() || '';
    const fazNoRaw = url.searchParams.get('faz_no')?.trim() || '';
    const fazNo = Number(fazNoRaw);
    const activityContext = url.searchParams.get('activity_context') === 'business_partner' ? 'business_partner' : 'customer';

    if (!musteriId || !Number.isFinite(fazNo)) {
      return NextResponse.json({ message: 'musteri_id ve faz_no gerekli' }, { status: 400 });
    }

    const admin = createPgAdminClient();
    const { data: customer } = await admin.from('musteriler').select('owner_user_id,sorumlu').eq('id', musteriId).maybeSingle();
    if (!customer) return NextResponse.json({ message: 'Müşteri bulunamadı' }, { status: 404 });
    assertOwnedResourceAccess({ user: me, resource: customer, ownPermission: 'activity.read', anyPermission: 'activity.read.any' });

    const { data: phaseStatus } = await admin
      .from('pipeline_eventleri')
      .select('durum, owner, partner_owner, created_at')
      .eq('musteri_id', musteriId)
      .eq('faz_no', fazNo)
      .eq('activity_context', activityContext)
      .not('durum', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: pipeline } = await admin
      .from('organization_pipeline_states')
      .select('active_phase_no, status, owner, partner_owner')
      .eq('customer_id', musteriId)
      .eq('context_key', activityContext)
      .maybeSingle();

    return NextResponse.json({
      durum: phaseStatus?.durum ?? (pipeline?.active_phase_no === fazNo ? pipeline?.status ?? null : null),
      owner: phaseStatus?.owner ?? (pipeline?.active_phase_no === fazNo ? pipeline?.owner ?? null : null),
      partner_owner: phaseStatus?.partner_owner ?? (pipeline?.active_phase_no === fazNo ? pipeline?.partner_owner ?? null : null),
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
