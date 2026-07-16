import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const includeDirs = ['app', 'components', 'lib'];
const allowedLargeLimits = new Set([
  'app/api/reports/quotes/route.ts',
  'app/api/reports/weekly-activities/route.ts',
  'app/api/crm/stats/route.ts',
]);

function walk(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.next') continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(item.name)) out.push(full);
  }
  return out;
}

const files = includeDirs.flatMap((dir) => fs.existsSync(path.join(root, dir)) ? walk(path.join(root, dir)) : []);
const findings = [];

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const limitMatch = line.match(/\.limit\((\d+)\)/);
    if (limitMatch) {
      const limit = Number(limitMatch[1]);
      if (limit > 1000 && !allowedLargeLimits.has(rel)) {
        findings.push({ severity: 'WARN', rel, lineNo, rule: 'large-limit', detail: `.limit(${limit}) pagination/search ile daraltılmalı` });
      }
    }
    if (/\.select\(['"]\*['"]/.test(line)) {
      findings.push({ severity: 'WARN', rel, lineNo, rule: 'select-star', detail: 'select(*) payload büyütür; liste ekranlarında kolon bazlı select tercih edilmeli' });
    }
    if (/fetch\(['"`][^'"`]*\/api\//.test(line) && !/cache:\s*['"]no-store['"]/.test(line) && !/method:\s*['"]POST['"]/.test(line)) {
      findings.push({ severity: 'INFO', rel, lineNo, rule: 'fetch-cache', detail: 'GET fetch no-store değilse eski veri riski kontrol edilmeli' });
    }
  });
}

const critical = findings.filter((f) => f.severity === 'ERROR');
console.log('CRM QA Agent');
console.log(`Taranan dosya: ${files.length}`);
console.log(`Bulgu: ${findings.length}`);
for (const f of findings.slice(0, 80)) {
  console.log(`${f.severity} ${f.rule} ${f.rel}:${f.lineNo} - ${f.detail}`);
}
if (findings.length > 80) console.log(`... ${findings.length - 80} bulgu daha`);
if (critical.length) process.exit(1);
