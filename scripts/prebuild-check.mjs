import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'app/layout.tsx',
  'app/(panel)/layout.tsx',
  'lib/db.ts',
  'lib/auth.ts',
  'lib/pg/client.ts',
  '.env.local.example',
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const forbiddenDependencies = ['@supabase/supabase-js', '@supabase/ssr'];
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
const forbidden = forbiddenDependencies.filter((name) => dependencies[name]);

if (missing.length || forbidden.length) {
  if (missing.length) console.error(`Eksik dosyalar: ${missing.join(', ')}`);
  if (forbidden.length) console.error(`Kaldirilmasi gereken eski bagimliliklar: ${forbidden.join(', ')}`);
  process.exit(1);
}

console.log('Pre-build kontrolu basarili: PostgreSQL yapisi ve temel dosyalar hazir.');
