import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { access, mkdir } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { requireAdminOrThrow } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const execFileAsync = promisify(execFile);

function safeStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function backupDirectory() {
  return process.env.DB_BACKUP_DIR || 'C:\\pax-crm-db-backups';
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePgDumpCommand() {
  const envPath = process.env.PG_DUMP_PATH?.trim();
  if (envPath) {
    if (await fileExists(envPath)) return envPath;
    throw new Error(`PG_DUMP_PATH bulundu ama dosya yok: ${envPath}`);
  }

  if (process.platform !== 'win32') return 'pg_dump';

  const candidates = ['18', '17', '16', '15', '14'].map(
    (version) => `C:\\Program Files\\PostgreSQL\\${version}\\bin\\pg_dump.exe`,
  );

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(
    `pg_dump.exe bulunamadı. PostgreSQL 18 kullanıyorsanız beklenen konum: C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe. ` +
      `Farklı klasöre kuruluysa .env içine PG_DUMP_PATH=... ekleyin.`,
  );
}

function normalizeBackupError(error: unknown) {
  if (error instanceof Error) {
    if ('code' in error && (error as { code?: string }).code === 'ENOENT') {
      return 'pg_dump çalıştırılamadı. PostgreSQL bin klasörü bulunamadı. PostgreSQL 18 için C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe kontrol edin veya .env içine PG_DUMP_PATH ekleyin.';
    }
    return error.message;
  }
  return 'DB yedeği alınamadı.';
}

export async function POST() {
  try {
    await requireAdminOrThrow();

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ ok: false, message: 'DATABASE_URL tanımlı değil.' }, { status: 500 });
    }

    const dir = backupDirectory();
    await mkdir(dir, { recursive: true });

    const fileName = `crm-db-yedek-${safeStamp()}.bak`;
    const filePath = path.join(dir, fileName);
    const pgDump = await resolvePgDumpCommand();

    await execFileAsync(pgDump, ['--format=custom', '--no-owner', '--no-privileges', '--file', filePath, databaseUrl], {
      windowsHide: true,
      timeout: 1000 * 60 * 10,
      maxBuffer: 1024 * 1024,
    });

    return NextResponse.json({ ok: true, fileName, filePath, pgDumpPath: pgDump });
  } catch (error) {
    return NextResponse.json({ ok: false, message: normalizeBackupError(error) }, { status: 500 });
  }
}
