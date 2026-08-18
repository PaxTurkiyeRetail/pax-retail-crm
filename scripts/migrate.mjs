import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const migrationsDirectory = path.resolve(process.cwd(), 'db', 'migrations');
const files = (await readdir(migrationsDirectory))
  .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
  .sort((a, b) => a.localeCompare(b));

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query('select pg_advisory_lock($1)', [2_026_081_601]);
  await client.query(`
    create table if not exists public.crm_schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query(
      'select checksum from public.crm_schema_migrations where version = $1',
      [file],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration was modified: ${file}`);
      }
      process.stdout.write(`skip ${file}\n`);
      continue;
    }

    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into public.crm_schema_migrations(version, checksum) values ($1, $2)',
        [file, checksum],
      );
      await client.query('commit');
      process.stdout.write(`applied ${file}\n`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.query('select pg_advisory_unlock($1)', [2_026_081_601]).catch(() => undefined);
  await client.end();
}
