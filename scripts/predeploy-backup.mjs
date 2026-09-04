import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Veritabanı yedeği (pg_dump, custom format) + saklama kuralı.
//
// Kullanım:
//   npm run db:backup:predeploy            → backups/predeploy-<zaman>.dump, son 10 tanesi tutulur
//   npm run db:backup:daily                → backups/daily-<zaman>.dump, son 14 tanesi tutulur (sunucu cron'u)
//   node scripts/predeploy-backup.mjs --prefix daily --keep 14   (aynı şey, argümanla)
//
// Ortam değişkenleri:
//   DATABASE_URL      zorunlu
//   DB_BACKUP_DIR     yedek klasörü (varsayılan: ./backups — git dışıdır)
//   DB_BACKUP_PREFIX  dosya adı öneki (varsayılan: predeploy)
//   DB_BACKUP_KEEP    aynı önekli en yeni kaç yedek tutulsun (varsayılan: 10; 0 = silme)
//   PG_DUMP_PATH      pg_dump yolu (varsayılan: PATH'teki pg_dump)
//
// Saklama kuralı yalnızca AYNI önekli dosyalara dokunur: günlük yedekler
// deploy yedeklerini, deploy yedekleri günlükleri silmez.

const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const backupDirectory = path.resolve(process.cwd(), process.env.DB_BACKUP_DIR ?? 'backups');
const parsed = path.parse(backupDirectory);
if (backupDirectory === parsed.root) throw new Error('DB_BACKUP_DIR cannot be a filesystem root.');

// Komut satırı argümanları ortam değişkenlerini ezer (Windows'ta env atamak zor).
function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const prefix = (String(argValue('--prefix') ?? process.env.DB_BACKUP_PREFIX ?? 'predeploy').trim() || 'predeploy').replace(/[^a-zA-Z0-9_-]/g, '');
const keepRaw = Number(argValue('--keep') ?? process.env.DB_BACKUP_KEEP ?? 10);
const keep = Number.isFinite(keepRaw) && keepRaw >= 0 ? Math.floor(keepRaw) : 10;

await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const backupFile = path.join(backupDirectory, `${prefix}-${timestamp}.dump`);
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

process.stdout.write(`Yedek alındı: ${backupFile}\n`);

// Saklama kuralı: aynı önekli yedeklerden en yeni `keep` tanesi kalır.
if (keep > 0) {
  const pattern = new RegExp(`^${prefix}-\\d{8}-\\d{6}\\.dump$`);
  const entries = await readdir(backupDirectory);
  const candidates = [];
  for (const name of entries) {
    if (!pattern.test(name)) continue;
    const fullPath = path.join(backupDirectory, name);
    const info = await stat(fullPath);
    if (info.isFile()) candidates.push({ fullPath, name, mtime: info.mtimeMs });
  }
  candidates.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
  const stale = candidates.slice(keep);
  for (const file of stale) {
    await unlink(file.fullPath);
    process.stdout.write(`Eski yedek silindi: ${file.name}\n`);
  }
  process.stdout.write(`Saklama: "${prefix}-*" için son ${keep} yedek tutuluyor (${Math.min(candidates.length, keep)} dosya).\n`);
}
