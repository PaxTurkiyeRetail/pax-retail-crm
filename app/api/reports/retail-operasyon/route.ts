import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow, userHasPermission } from '@/lib/authz';
import { buildRetailOperasyon } from '@/lib/reports/retail-operasyon';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await requireReportsAccessOrThrow();
    const year = Number(new URL(request.url).searchParams.get('year')) || undefined;
    const payload = await buildRetailOperasyon({ year });
    const any = userHasPermission(user, 'forecast.write.any');
    const own = userHasPermission(user, 'forecast.write.own');
    const allowed = (owner?: string | null) => any || (own && owner === user.id);
    return NextResponse.json({ ...payload, canEditForecast: any || own,
      opportunities: {
        current: payload.opportunities.current.map(row => ({ ...row, canEdit: allowed(row.ownerUserId) })),
        next: payload.opportunities.next.map(row => ({ ...row, canEdit: allowed(row.ownerUserId) })),
      },
      crm: payload.crm.map(row => ({ ...row, canPlan: allowed(row.ownerUserId) })),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Yetkisiz' }, { status: error?.status || 500 });
  }
}
