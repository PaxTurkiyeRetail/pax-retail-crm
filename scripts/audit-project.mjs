import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const findings = [];
const stats = { ts: 0, apiRoutes: 0, pages: 0, clientFetches: 0 };

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

for (const file of walk(root)) {
  if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;
  const rel = relative(root, file).replaceAll('\\', '/');
  const content = readFileSync(file, 'utf8');
  stats.ts += 1;
  if (rel.startsWith('app/api/') && rel.endsWith('/route.ts')) stats.apiRoutes += 1;
  if (rel.startsWith('app/') && rel.endsWith('/page.tsx')) stats.pages += 1;
  const fetchCount = (content.match(/fetch\(/g) || []).length;
  stats.clientFetches += fetchCount;

  if (/source:\s*["']\/api\/:path\*/.test(content) && /s-maxage|stale-while-revalidate/.test(content)) {
    findings.push({ level: 'critical', file: rel, message: 'API cache dinamik CRM verilerini bayatlatabilir.' });
  }
  if (/select\(['"]\*/.test(content)) {
    findings.push({ level: 'warn', file: rel, message: 'select(*) kullanımı var; liste ekranlarında kolon seçimi daraltılabilir.' });
  }
  if (/limit\(5000\)|limit\(10000\)/.test(content)) {
    findings.push({ level: 'warn', file: rel, message: 'Yüksek limit var; filtre/pagination büyüdükçe yavaşlayabilir.' });
  }
  if (/catch\s*\([^)]*\)\s*{\s*}/.test(content)) {
    findings.push({ level: 'info', file: rel, message: 'Sessiz catch bloğu var; kritik akışlarda log/toast eklenebilir.' });
  }
}

console.log(JSON.stringify({ stats, findings }, null, 2));
