// Deploy sonrası yeni ve korunmuş eski CSS/JS adreslerini HTTP üzerinden doğrular.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const active = process.env.NEXT_DIST_DIR || (await readFile('.next-active', 'utf8').catch(() => '.next')).trim();
if (!['.next', '.next-a', '.next-b'].includes(active)) throw new Error('Invalid build directory.');
const base = process.env.ASSET_CHECK_URL || 'http://127.0.0.1:5043';
const staticRoot = path.join(active, 'static');
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : /\.(css|js)$/.test(entry.name) ? [file] : [];
  }));
  return nested.flat();
}
const files = await walk(staticRoot);
if (!files.length) throw new Error('No static assets found.');
const failures = [];
let heroStyles = false;
for (let i = 0; i < files.length; i += 8) {
  await Promise.all(files.slice(i, i + 8).map(async (file) => {
    const url = `${base}/_next/static/${path.relative(staticRoot, file).split(path.sep).join('/')}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !/javascript|text\/css/.test(contentType)) failures.push(`${response.status} ${url}`);
      const text = await response.text();
      if (file.endsWith('.css') && text.includes('.ch-detail-grid') && text.includes('.ch-donut')) heroStyles = true;
    } catch (error) { failures.push(`${url}: ${error.message}`); }
  }));
}
if (!heroStyles) failures.push('Customer summary card CSS missing.');
if (failures.length) throw new Error(failures.join('\n'));
console.log(`PASS: ${files.length} CSS/JS assets return HTTP 200 with valid content types; customer card styles present (${active}).`);
