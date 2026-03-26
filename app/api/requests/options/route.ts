import { NextResponse } from 'next/server';
import { requireAllowedUserOrThrow } from '@/lib/authz';
import { db } from '@/lib/db';
import { listAllowedUsersForRequests } from '@/lib/request-users';

export async function GET() {
  try {
    await requireAllowedUserOrThrow();

    const [categoriesResult, users, teamsResult] = await Promise.all([
      db.query('select id, name, color, sla_hours from public.request_categories order by name asc'),
      listAllowedUsersForRequests(),
      db.query('select id, name from public.teams order by name asc'),
    ]);

    return NextResponse.json({
      categories: categoriesResult.rows,
      users,
      teams: teamsResult.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: err.status ?? 500 });
  }
}
