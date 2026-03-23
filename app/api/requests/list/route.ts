import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isAdminLike } from '@/lib/roles';

export async function GET(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const sb = createSupabaseAdminClient();
    const { searchParams: p } = new URL(req.url);

    const page     = Math.max(1, Number(p.get('page') || 1));
    const pageSize = Math.min(100, Math.max(5, Number(p.get('pageSize') || 25)));
    const status   = p.get('status') || '';
    const priority = p.get('priority') || '';
    const sla      = p.get('sla') || '';
    const assignee = p.get('assignee') || '';
    const mine     = p.get('mine') === '1';
    const q        = (p.get('q') || '').trim();

    let query = sb
      .from('requests')
      .select(`
        id, created_at, updated_at, title, status, priority, sla_status, sla_hours, due_at,
        requester_id, requester_name, assignee_id, assignee_name, channel, category_id,
        first_response_at, resolved_at,
        request_categories(name, color)
      `, { count: 'exact' });

    // Role-based visibility: non-admin sees only own requests OR assigned to them
    if (!isAdminLike(user.role)) {
      query = query.or(`requester_id.eq.${user.id},assignee_id.eq.${user.id}`);
    }

    if (mine)     query = query.or(`requester_id.eq.${user.id},assignee_id.eq.${user.id}`);
    if (status)   query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (sla)      query = query.eq('sla_status', sla);
    if (assignee) query = query.eq('assignee_id', assignee);
    if (q)        query = query.ilike('title', `%${q}%`);

    const from = (page - 1) * pageSize;
    query = query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
