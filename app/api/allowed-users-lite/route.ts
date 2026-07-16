import { NextResponse } from 'next/server';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    await requireCrmAccessOrThrow();
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }

  const admin = createPgAdminClient();
  const { data, error } = await admin
    .from('allowed_users')
    .select('email, full_name')
    .eq('is_active', true)
    .not('full_name', 'is', null)
    .order('full_name', { ascending: true });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const users = (data ?? []).filter((row: any) => String(row.full_name ?? '').trim().length > 0);
  return NextResponse.json({ users });
}
