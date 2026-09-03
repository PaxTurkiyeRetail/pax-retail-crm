// Tema / okunurluk denetçisi  —  node scripts/theme-audit.mjs
//
// Çalıştırma:
//   node scripts/theme-audit.mjs              → çalışma ağacındaki CSS
//   REV=HEAD node scripts/theme-audit.mjs     → o git sürümü (regresyon karşılaştırması)
//   SHOT=1 node scripts/theme-audit.mjs       → .theme-audit/ altına ekran görüntüsü
//
// Çıkış kodu 0 = hata yok, 1 = okunurluk hatası var.
//
//
// Neden var: ekranlar iki ayrı "koyu" sinyali karıştırıyor — uygulamanın
// data-theme="dark" düğmesi ve işletim sisteminin prefers-color-scheme'i.
// Bu script dört kombinasyonu da gerçek CSS ile render eder, her yazı düğümünün
// GERÇEK arka planını (şeffafsa atalarına yürüyerek) bulur ve WCAG kontrast
// oranını hesaplar. 4.5:1 altındaki her şey rapor edilir → okunurluk ölçülür,
// tahmin edilmez.
//
// Kullanım:
//   node audit.mjs                 → çalışma ağacı
//   REV=HEAD node audit.mjs        → o git sürümü
//   SHOT=1 node audit.mjs          → ekran görüntüsü de al

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Bu araç playwright ister (proje bağımlılığı DEĞİL, sadece geliştirici aracı):\n' +
    '  npm i -D playwright && npx playwright install chromium\n' +
    'Sonra: node scripts/theme-audit.mjs');
  process.exit(2);
}

const REPO = process.env.REPO || process.cwd();
const OUT = process.env.OUT || path.join(REPO, '.theme-audit');
const REV = process.env.REV || '';
const TAG = REV ? REV.replace(/[^a-zA-Z0-9]/g, '') : 'work';

// Next.js yükleme sırası: app/layout.tsx → app/globals.css, sonra PanelShell
// importları, en sonda sayfanın kendi CSS'i.
const CSS_ORDER = [
  'app/globals.css',
  'styles/globals.css',
  'styles/sidebar.css',
  'styles/premium-ui.css',
  'styles/premium-enterprise.css',
  'styles/mobile-hardening.css',
  'styles/seller-followup.css',
];

const read = (file) => REV
  ? execFileSync('git', ['show', `${REV}:${file}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 40e6 })
  : readFile(path.join(REPO, file), 'utf8');

const css = [];
for (const file of CSS_ORDER) css.push(`/* ${file} */\n` + await read(file));

const ROWS = [
  { m: 'ADİL IŞIK', s: 'Hazır Giyim', k: 'Peyami Emirmahmutoğlu (Finans Direktörü)', t: 'Müşteri', mo: '—', ko: 'Muafiyet başvurusunun sonuçlanması bekleniyor. Muafiyetin onaylanmasının ardından A910SE cihazları ile ilerlenmesi planlanıyor.', d: '30 Ağu 2026', st: 'overdue' },
  { m: 'YURTİÇİ KARGO', s: 'Lojistik & Kargo', k: 'PAX Türkiye', t: 'İç ekip', mo: '—', ko: 'Müşteri fiyat teklifini bekliyor.', d: '01 Eyl 2026', st: 'overdue' },
  { m: 'BOYNER', s: 'Hazır Giyim', k: 'Müşteri - PAX Türkiye', t: 'Diğer', mo: 'A6630: 100, A6650: 100', ko: 'Kiralama modelini sunacağız. Ayrıca Soti MDM’lerine cihazlarımızı ekleme talepleri var.', d: '03 Eyl 2026', st: 'near' },
  { m: 'TESPO', s: 'Gıda Perakendesi', k: 'PAX Türkiye', t: 'İç ekip', mo: 'A80: 121, S210: 121', ko: 'Müşteri sözleşmeyi bekliyor.', d: '03 Eyl 2026', st: 'near' },
  { m: 'ÜLKER', s: 'FMCG Dağıtım Kanalları', k: 'Pax Türkiye - Ödeal', t: 'İç ekip', mo: '—', ko: 'Müşterinin isterleri var. Çözülmeden yaygınlaşamaz.', d: '10 Eyl 2026', st: 'near' },
  { m: 'DAMAT', s: 'Hazır Giyim', k: 'Samet Ocakçı', t: 'Müşteri', mo: 'A80: 200, S210: 200', ko: 'Muafiyet bekleniyor.', d: '14 Eyl 2026', st: 'near' },
  { m: 'TOYPA', s: 'Ev & Yaşam / Yapı Market', k: 'Müşteri', t: 'Müşteri', mo: 'A80: 590', ko: 'Toshiba ile sahada yaygın olmamamızdan çekinceleri var; eylülde versiyon yükseltebilecekler.', d: '17 Eyl 2026', st: '' },
];

const rows = ROWS.map((r) => `<tr>
  <td><span class="sfu-customer">${r.m}</span><span class="sfu-sector">${r.s}</span></td>
  <td>${r.k}<span class="sfu-sector">${r.t}</span></td>
  <td class="nowrap">${r.mo}</td>
  <td>${r.ko}</td>
  <td class="nowrap"><span class="sfu-pill ${r.st}">${r.d}</span>${r.st === 'overdue' ? '<span class="sfu-note">Tarih geçti</span>' : ''}</td>
</tr>`).join('');

const html = (theme) => `<!doctype html>
<html lang="tr"${theme === 'dark' ? ' data-theme="dark"' : theme === 'light' ? ' data-theme="light"' : ''}>
<head><meta charset="utf-8"><style>${css.join('\n')}</style></head>
<body><div class="pax-shell"><main class="pax-main"><div class="pax-main-inner"><div class="sfu-page">
  <section class="sfu-hero">
    <div class="sfu-hero-copy"><span class="sfu-eyebrow">Satışçı Takip Raporu</span>
      <h1>Takip Listesi — Tüm Portföy</h1><p>Açık engelleri, kimde beklediğini ve çözüm tarihini tek ekranda gör.</p></div>
    <div class="sfu-hero-actions"><select class="sfu-select"><option>Tüm Satıcılar</option></select><button class="sfu-btn light">Yenile</button></div>
  </section>
  <div class="sfu-kpis">
    <div class="sfu-kpi accent"><div class="sfu-kpi-value">37</div><div class="sfu-kpi-label">Açık Takip</div><div class="sfu-kpi-hint">Tüm portföyde durumu açık engel</div></div>
    <div class="sfu-kpi"><div class="sfu-kpi-value">4.812</div><div class="sfu-kpi-label">Toplam Adet</div><div class="sfu-kpi-hint">Takip listesindeki hesapların forecast adetleri</div></div>
    <div class="sfu-kpi warn"><div class="sfu-kpi-value">2.140</div><div class="sfu-kpi-label">Yakın Vadeli Takip</div><div class="sfu-kpi-hint">Eylül–Kasım: ADİL IŞIK, YURTİÇİ KARGO, BOYNER, TESPO…</div></div>
  </div>
  <div class="sfu-tabs"><button class="sfu-tab active">Takip Listesi</button><button class="sfu-tab">Kişi Bazlı Aktivite</button></div>
  <section class="sfu-panel">
    <div class="sfu-panel-head"><h2>Takip Listesi</h2><span>37 kayıt · sayfa 1/4</span></div>
    <div class="sfu-table-wrap"><table class="sfu-table">
      <thead><tr><th>Müşteri</th><th>Konu Kimde</th><th>Model / Adet</th><th>Takip Konusu</th><th>Çözüm</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Toplam</td><td></td><td class="num">1.432</td><td></td><td></td></tr></tfoot>
    </table></div>
    <div class="sfu-pager"><span class="sfu-pager-info">37 kaydın 1–10 arası</span>
      <span class="sfu-pager-buttons"><button disabled>Önceki</button><button>Sonraki</button></span></div>
  </section>
</div></div></main></div></body></html>`;


// ---- İkinci sayfa: Müşteriler listesi (styled-jsx bileşenden çıkarılır) ----
const compSrc = await read('components/crm/CrmCustomersClient.tsx');
const jsx = compSrc.split('<style jsx>{`')[1].split('`}</style>')[0]
  .replace(/:global\(([^)]*)\)/g, '$1');   // styled-jsx :global() → düz seçici

const custRows = [
  ['5MASA', 'Gıda Perakendesi', 'Ömer Canatar', 'Kasa Firması', 'Entegre', 'FAZ 12 · Business', 'Tamam'],
  ['ADİL IŞIK', 'Hazır Giyim', 'Seda Kesikoğlu', 'Kendi Kasası', 'Entegre Değil', 'FAZ 4 · Analiz', 'Eksik'],
  ['NEXIVOX', 'İş Ortağı', 'Ömer Canatar', '—', 'Entegre', 'İŞ ORTAĞI FAZ 3', 'Yok'],
  ['TESPO', 'Gıda Perakendesi', 'Furkan Yılmaz', 'Kasa Firması', 'Entegre', 'FAZ 18 · Yayılım', 'Tamam'],
].map(([m,s,o,k,e,f,ku]) => `<tr>
  <td><a class="name" href="#">${m}</a><div class="muted">Müşteri</div></td>
  <td class="ct-cell" title="${s}">${s}</td>
  <td class="ct-cell" title="${o}">${o}</td>
  <td class="ct-cell" title="${k}">${k}</td>
  <td class="ct-cell" title="${e}">${e}</td>
  <td class="phase-column"><span class="pill phase-pill" style="background:var(--chip-indigo-bg);color:var(--chip-indigo-color);border:1px solid var(--chip-indigo-bd)">${f}</span></td>
  <td class="kunye-column"><span class="pill kunye-pill" style="background:var(--chip-green-bg);color:var(--chip-green-color);border:1px solid var(--chip-green-bd)">${ku}</span></td>
  <td class="actions"><a class="link-btn" href="#">Künye</a><a class="link-btn" href="#">Detay</a></td>
</tr>`).join('');

const custHtml = (theme) => `<!doctype html>
<html lang="tr"${theme === 'dark' ? ' data-theme="dark"' : ' data-theme="light"'}>
<head><meta charset="utf-8"><style>${css.join('\n')}\n/* styled-jsx */\n${jsx}</style></head>
<body><div class="pax-shell"><main class="pax-main"><div class="pax-main-inner">
<main class="customers-page">
  <section class="surface">
    <div class="section-head"><div>
      <div class="section-kicker">Portföy Komuta Merkezi</div>
      <div class="section-title">Müşteriler</div>
      <div class="section-note">367 firma · sorumlu, sektör ve faz kırılımı</div>
    </div><div><button class="primary">Yeni Müşteri</button> <button class="ghost">Dışa Aktar</button></div></div>

    <div class="action-grid">
      <button class="action-card active"><div class="action-card-top"><span class="action-icon">◆</span><span class="action-value">367</span></div>
        <span class="action-title">Tüm Portföy</span><span class="action-desc">Sorumlusu olan tüm kayıtlar</span></button>
      <button class="action-card"><div class="action-card-top"><span class="action-icon">▲</span><span class="action-value">42</span></div>
        <span class="action-title">Künye Eksik</span><span class="action-desc">Doldurulması gereken künyeler</span></button>
      <button class="action-card"><div class="action-card-top"><span class="action-icon">●</span><span class="action-value">18</span></div>
        <span class="action-title">Fazsız</span><span class="action-desc">Pipeline fazı girilmemiş</span></button>
    </div>

    <div class="search-shell" style="margin-top:14px">
      <div class="search-input"><span>⌕</span><input placeholder="Firma, sorumlu veya sektör ara"></div>
      <select class="select"><option>Tüm sorumlular</option></select>
      <select class="select"><option>Tüm sektörler</option></select>
      <select class="select"><option>Tüm fazlar</option></select>
    </div>

    <div class="result-bar" style="margin-top:14px">
      <div class="result-copy"><div class="result-metric"><strong>367</strong><span>kayıt bulundu</span></div>
      <div class="token-row"><span class="token">Arama: 5masa<button>×</button></span></div></div>
    </div>
  </section>

  <section class="surface">
    <div class="table-wrap">
      <table class="customers-table">
        <thead><tr><th>Firma</th><th>Sektör</th><th>Sorumlu</th><th>Kasa</th><th>Entegrasyon</th><th>Faz</th><th>Künye</th><th>İşlem</th></tr></thead>
        <tbody>${custRows}</tbody>
      </table>
    </div>
    <div class="pager"><span class="muted">367 kaydın 1–25 arası</span>
      <span class="pager-buttons"><button class="ghost">Önceki</button><button class="ghost">Sonraki</button></span></div>
    <div class="message" style="margin-top:12px">Sektör listesinden Banka/Vertical kaldırıldı; İş Kolu müşteri kartından yönetilir.</div>
  </section>
</main>
</div></main></div></body></html>`;

// Sayfa içinde çalışan denetim: her yazı düğümünün gerçek arka planını bul,
// WCAG kontrast oranını hesapla, eşiğin altındakileri döndür.
const AUDIT = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

  // Efektif arka plan adayları: şeffaf katmanlar atalara doğru bindirilir.
  // Gradient'ler atlanmaz — durak renkleri ayrı aday olarak çıkarılır ve
  // kontrast EN KÖTÜ adaya göre hesaplanır (ör. koyu→açık lacivert hero).
  const gradColors = (bgImage) => {
    const out = [];
    const re = /rgba?\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(bgImage))) {
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      const c = { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      if (c.a >= 0.5) out.push(c);   // yarı şeffaf parlaklık katmanları zemin sayılmaz
    }
    return out;
  };
  const effBg = (el) => {
    const layers = [];      // {type:'color'|'grad', ...}
    let node = el;
    while (node && node.nodeType === 1) {
      const s = getComputedStyle(node);
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        const stops = gradColors(s.backgroundImage);
        if (stops.length) layers.push({ type: 'grad', stops });
      }
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push({ type: 'color', c }); if (c.a === 1) break; }
      node = node.parentElement;
    }
    // Alttan üste doğru bindir; gradient katmanı birden çok aday üretir.
    let candidates = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const next = [];
      for (const base of candidates) {
        if (layer.type === 'color') next.push(over(layer.c, base));
        else for (const stop of layer.stops) next.push(over(stop, base));
      }
      candidates = next.slice(0, 8);   // kombinasyon patlamasını sınırla
    }
    return { candidates };
  };

  const results = [];
  const gradients = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const text = n.nodeValue.trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') continue;
    const fg = parse(s.color);
    if (!fg) continue;
    const { candidates } = effBg(el);
    // En kötü aday: yazının en zor okunduğu zemin.
    let bg = candidates[0], r = Infinity;
    for (const cand of candidates) {
      const rr = ratio(over(fg, cand), cand);
      if (rr < r) { r = rr; bg = cand; }
    }
    const size = parseFloat(s.fontSize), weight = Number(s.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (r < need) {
      results.push({
        text: text.slice(0, 42),
        sel: el.className ? `.${String(el.className).split(' ').join('.')}` : el.tagName.toLowerCase(),
        fg: s.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        ratio: Number(r.toFixed(2)), need,
      });
    }
  }
  // Satır zeminleri: koyu/açık karışıklığını yakalamak için ilk satırların bg'si
  const rowBg = [...document.querySelectorAll('.sfu-table tbody tr, .customers-table tbody tr')].slice(0, 6).map((tr, i) => {
    const c = effBg(tr.querySelector('td')).candidates[0];
    return `${i + 1}:rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
  });
  return { fails: results, rowBg, gradientSkipped: gradients.length };
};
// END_AUDIT

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let totalFails = 0;
const PAGES = { rapor: html, musteriler: custHtml };
for (const [pageName, render] of Object.entries(PAGES)) {
for (const theme of ['dark', 'light']) {
  for (const os of ['dark', 'light']) {
    const file = path.join(OUT, `p-${TAG}-${pageName}-${theme}-os${os}.html`);
    await writeFile(file, render(theme));
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: os });
    await page.goto('file://' + file);
    await page.waitForTimeout(150);
    const { fails, rowBg, gradientSkipped } = await page.evaluate(AUDIT);
    totalFails += fails.length;
    console.log(`\n===== ${TAG} · ${pageName} · tema=${theme} · OS=${os} · ${fails.length} okunurluk hatası =====`);
    console.log('  satır zeminleri: ' + rowBg.join('  ') + `   (gradient zeminli ${gradientSkipped} yazı atlandı)`);
    for (const f of fails.slice(0, 12)) {
      console.log(`  ✗ ${f.ratio}:1 (min ${f.need}) ${f.sel}  fg=${f.fg} bg=${f.bg}${f.gradient ? ' [gradient]' : ''}  "${f.text}"`);
    }
    if (fails.length > 12) console.log(`  … +${fails.length - 12} daha`);
    if (process.env.SHOT) await page.screenshot({ path: path.join(OUT, `shot-${TAG}-${pageName}-${theme}-os${os}.png`), fullPage: true });
    await page.close();
  }
}
}
await browser.close();
console.log(`\nTOPLAM: ${totalFails} okunurluk hatası (${TAG})`);
if (totalFails > 0) {
  console.log('\nKURAL: renkler globals.css token\'larından gelir; token\'lar yalnızca');
  console.log('<html data-theme> ile değişir. Sayfa CSS\'inde prefers-color-scheme ile');
  console.log('renk seçmek ya da sabit beyaz zemin + token yazı karıştırmak bu hataları üretir.');
  process.exitCode = 1;
}
