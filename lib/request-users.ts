import 'server-only';
import { db } from '@/lib/db';

let cachedIdColumn: string | null = null;

async function getAllowedUsersIdColumn() {
  if (cachedIdColumn) return cachedIdColumn;

  const result = await db.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'allowed_users'
        and column_name in ('user_id', 'id')
    `,
  );

  const names = new Set(result.rows.map((row) => String(row.column_name)));
  cachedIdColumn = names.has('user_id') ? 'user_id' : 'id';
  return cachedIdColumn;
}

export async function listAllowedUsersForRequests() {
  const idColumn = await getAllowedUsersIdColumn();
  const result = await db.query(
    `
      select ${idColumn} as user_id, full_name, role
      from public.allowed_users
      where coalesce(is_active, true) = true
      order by full_name asc nulls last, email asc nulls last
    `,
  );
  return result.rows;
}

export async function getAllowedUserNameForRequests(userId: string | null | undefined) {
  if (!userId) return null;
  const idColumn = await getAllowedUsersIdColumn();
  const result = await db.query(
    `
      select full_name
      from public.allowed_users
      where ${idColumn} = $1
      limit 1
    `,
    [userId],
  );
  return result.rows[0]?.full_name ?? null;
}
