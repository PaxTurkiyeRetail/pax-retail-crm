import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    await requireAllowedUserOrThrow();
    const sb = createSupabaseAdminClient();

    const [{ data: categories }, { data: users }, { data: teams }] = await Promise.all([
      sb.from('request_categories').select('id, name, color, sla_hours').order('name'),
      sb.from('allowed_users').select('user_id, full_name, role').order('full_name'),
      sb.from('teams').select('id, name').order('name'),
    ]);

    return NextResponse.json({
      categories: categories ?? [],
      users: users ?? [],
      teams: teams ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
