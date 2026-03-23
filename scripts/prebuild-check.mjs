import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const warnings = [];
const infos = [];

function walk(dir) {
  const output = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

const files = walk(root).filter((file) => /\.(ts|tsx|js|jsx|md)$/.test(file));

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const usesClientHooks = /(useState|useEffect|useMemo|useCallback)\s*\(/.test(content);
  const hasUseClient = /^\s*["']use client["'];/.test(content);
  const usesJsxStyle = /<style jsx>/.test(content);

  if ((usesClientHooks || usesJsxStyle) && !hasUseClient && file.includes("components")) {
    warnings.push(`Client kontrolü: ${file.replace(root + "/", "")} dosyasında hook/styled-jsx var ama \"use client\" görünmüyor.`);
  }
}

const requiredDocs = ["README_BUILD_CHECKLIST.md", "BUILD_NOTES.md"];
for (const doc of requiredDocs) {
  if (!existsSync(join(root, doc))) {
    warnings.push(`Doküman eksik: ${doc}`);
  } else {
    infos.push(`Doküman hazır: ${doc}`);
  }
}

const routeChecks = [
  "app/(panel)/crm/system-tracker/page.tsx",
  "components/system/SystemRequirementStamp.tsx",
  "components/system/SystemTrackerClient.tsx",
];
for (const route of routeChecks) {
  if (!existsSync(join(root, route))) {
    warnings.push(`Beklenen dosya yok: ${route}`);
  } else {
    infos.push(`Kontrol edildi: ${route}`);
  }
}

console.log("\nPAX Retail CRM · Pre-build Kontrol\n");
for (const info of infos) console.log(`✓ ${info}`);
for (const warning of warnings) console.log(`! ${warning}`);

if (!warnings.length) {
  console.log("\nDurum: Kritik uyarı bulunmadı. Build öncesi temel kontroller tamam.\n");
} else {
  console.log(`\nDurum: ${warnings.length} uyarı bulundu. Build almadan önce gözden geçir.\n`);
}
