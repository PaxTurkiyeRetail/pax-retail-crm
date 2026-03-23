import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAllowedUserOrThrow();
    const sb = createSupabaseAdminClient();

    const [{ data: request, error }, { data: events }] = await Promise.all([
      sb.from('requests')
        .select('*, request_categories(name, color, sla_hours)')
        .eq('id', params.id)
        .single(),
      sb.from('request_events')
        .select('*')
        .eq('request_id', params.id)
        .order('created_at', { ascending: true }),
    ]);

    if (error) throw error;
    return NextResponse.json({ request, events: events ?? [] });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
