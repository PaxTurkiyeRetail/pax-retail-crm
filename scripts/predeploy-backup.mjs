import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const backupDirectory = path.resolve(process.cwd(), process.env.DB_BACKUP_DIR ?? 'backups');
const parsed = path.parse(backupDirectory);
if (backupDirectory === parsed.root) throw new Error('DB_BACKUP_DIR cannot be a filesystem root.');

await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const backupFile = path.join(backupDirectory, `predeploy-${timestamp}.dump`);
const pgDumpPath = String(process.env.PG_DUMP_PATH ?? 'pg_dump').trim() || 'pg_dump';

await new Promise((resolve, reject) => {
  const child = spawn(pgDumpPath, [
    databaseUrl,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `--file=${backupFile}`,
  ], { stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code}`)));
});

process.stdout.write(`Migration öncesi yedek: ${backupFile}\n`);
