import pg from 'pg';
import process from 'node:process';

const { Client } = pg;
const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const requiredColumns = {
  allowed_users: ['id', 'email', 'full_name', 'role', 'is_active'],
  user_sessions: ['user_id', 'session_token', 'expires_at'],
  password_reset_tokens: ['token', 'expires_at'],
  musteriler: ['id', 'musteri', 'sorumlu', 'sektor', 'entegrasyon_tipi', 'satis_olasiligi'],
  quotes: ['id', 'owner_name', 'owner_email', 'probability'],
  system_parameters: ['id', 'group_key', 'param_key', 'label', 'value', 'sort_order', 'is_active', 'meta'],
};

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const columnResult = await client.query(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = any($1::text[])`,
    [Object.keys(requiredColumns)],
  );
  const available = new Set(columnResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = Object.entries(requiredColumns).flatMap(([table, columns]) =>
    columns.filter((column) => !available.has(`${table}.${column}`)).map((column) => `${table}.${column}`),
  );
  if (missing.length) throw new Error(`Migration preflight failed; missing base columns: ${missing.join(', ')}`);

  const roleResult = await client.query(
    `select coalesce(role, '<null>') as role, count(*)::integer as count
     from public.allowed_users group by role order by role`,
  );
  const allowedRoles = new Set(['super_admin', 'admin', 'account_manager', 'itsm', 'user']);
  const invalidRoles = roleResult.rows.filter((row) => !allowedRoles.has(String(row.role)));
  if (invalidRoles.length) throw new Error(`Migration preflight failed; invalid roles: ${invalidRoles.map((row) => row.role).join(', ')}`);

  const customerOwnership = await client.query(
    `select count(*)::integer as total,
            count(*) filter (where matches = 1)::integer as uniquely_matched,
            count(*) filter (where matches = 0)::integer as unmatched,
            count(*) filter (where matches > 1)::integer as ambiguous
     from (
       select m.id, count(u.id)::integer as matches
       from public.musteriler m
       left join public.allowed_users u
         on lower(trim(coalesce(m.sorumlu, ''))) = lower(trim(coalesce(u.full_name, '')))
         or lower(trim(coalesce(m.sorumlu, ''))) = lower(trim(coalesce(u.email, '')))
       group by m.id
     ) ownership`,
  );

  const quoteOwnership = await client.query(
    `select count(*)::integer as total,
            count(*) filter (where matches = 1)::integer as uniquely_matched,
            count(*) filter (where matches = 0)::integer as unmatched,
            count(*) filter (where matches > 1)::integer as ambiguous
     from (
       select q.id, count(u.id)::integer as matches
       from public.quotes q
       left join public.allowed_users u
         on lower(trim(coalesce(q.owner_name, ''))) = lower(trim(coalesce(u.full_name, '')))
         or lower(trim(coalesce(q.owner_email, ''))) = lower(trim(coalesce(u.email, '')))
       group by q.id
     ) ownership`,
  );

  const extensionResult = await client.query(
    `select exists(select 1 from pg_extension where extname = 'pgcrypto') as pgcrypto_installed,
            (select rolsuper from pg_roles where rolname = current_user) as current_user_superuser`,
  );
  const extension = extensionResult.rows[0];
  if (!extension.pgcrypto_installed && !extension.current_user_superuser) {
    throw new Error('Migration preflight failed; pgcrypto is missing and the migration user is not a superuser.');
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    roles: roleResult.rows,
    customerOwnership: customerOwnership.rows[0],
    quoteOwnership: quoteOwnership.rows[0],
    pgcryptoInstalled: Boolean(extension.pgcrypto_installed),
  }, null, 2)}\n`);
} finally {
  await client.end();
}
