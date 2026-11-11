import { NextResponse } from 'next/server';
import { getUserDepartments } from '@/lib/authz';
import { builderErrorResponse, requireReportBuilderUser } from '@/lib/report-builder/http';
import { loadOwnerOptions } from '@/lib/reports/owner-filter.server';

export const dynamic = 'force-dynamic';

/** Rapor tasarımcısı satıcı filtresi: önce kişiler, sonra 'Havuz / Gruplar'. Değer = ad (boyut ifadesi adla karşılaştırır). */
export async function GET() {
  try {
    const user = await requireReportBuilderUser();
    const options = await loadOwnerOptions({ departments: await getUserDepartments(user) });
    return NextResponse.json({ options: options.map((o) => ({ value: o.label, label: o.label, group: o.group ?? null })) });
  } catch (error) {
    return builderErrorResponse(error);
  }
}
