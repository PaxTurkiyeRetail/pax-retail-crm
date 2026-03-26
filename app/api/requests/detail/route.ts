import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { isAdminLike } from '@/lib/roles';

export async function GET(req: Request) {
  try {
    const user = await requireAllowedUserOrThrow();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'id zorunlu' }, { status: 400 });
    }

    const params: unknown[] = [id];
    let accessSql = '';
    if (!isAdminLike(user.role)) {
      params.push(user.id);
      accessSql = ' and (r.requester_id = $2 or r.assignee_id = $2)';
    }

    const requestResult = await db.query(
      `
        select
          r.*,
          case
            when c.id is null then null
            else json_build_object('name', c.name, 'color', c.color, 'sla_hours', c.sla_hours)
          end as request_categories
        from public.requests r
        left join public.request_categories c on c.id = r.category_id
        where r.id = $1${accessSql}
        limit 1
      `,
      params,
    );

    const request = requestResult.rows[0] ?? null;
    if (!request) {
      return NextResponse.json({ message: 'Talep bulunamadı veya erişim yok' }, { status: 404 });
    }

    const eventsResult = await db.query(
      `
        select id, request_id, actor_id, actor_name, event_type, payload, created_at
        from public.request_events
        where request_id = $1
        order by created_at asc
      `,
      [id],
    );

    return NextResponse.json({ request, events: eventsResult.rows ?? [] });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
