import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { assembleFollowupDeck } from './seller-followup-pptx-assemble';
import { buildFollowupSlideSpecs, type FollowupSlideRow } from './seller-followup-pptx-shared';

// Sunum gerçekten üretiliyor mu? Şablonu açıp tam bir PPTX kurar ve paketi doğrular.
// Bu test olmadan "PowerPoint dosyayı açamıyor" hatası ancak canlıda fark edilirdi.

const summary = {
  openFollowupCount: 23,
  totalQuantity: 1275,
  nearTermQuantity: 640,
  nearTermCustomers: ['Damat', 'Gusto', 'Spx'],
  nearTermLabel: 'Ağustos–Ekim',
};

function rows(count: number, prefix = 'Firma'): FollowupSlideRow[] {
  return Array.from({ length: count }, (_, index) => ({
    musteri: `${prefix} ${index + 1}`,
    konuKimde: index % 2 ? 'PAX Türkiye' : 'Müşteri',
    modelAdetLabel: 'A80: 200, S210: 200',
    takipKonusu: 'Nebim lisans maliyeti nedeniyle karar bekleniyor',
    cozumTarihi: '2026-10-01',
  }));
}

async function loadTemplate() {
  return fs.readFile(path.join(process.cwd(), 'templates', 'takip-listesi-template.pptx'));
}

describe('Takip Listesi sunumu — paket kurgusu (16.09)', () => {
  it('kişi başına slayt üretir ve şablonun kendi slaytları kalmaz', async () => {
    const specs = buildFollowupSlideSpecs([
      { owner: 'Cem Koç', summary, rows: rows(3, 'Cem') },
      { owner: 'Furkan Kızılkurt', summary, rows: rows(25, 'Furkan') },
      { owner: 'Ömer Canatar', summary, rows: [] },
    ]);
    // 1 (Cem) + 2 (Furkan 25 satır → 22+3) + 1 (Ömer, boş) = 4
    expect(specs).toHaveLength(4);

    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    expect(buffer.length).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slideNames).toHaveLength(specs.length);

    // Sunum sırası: presentation.xml'deki sldId sayısı slayt sayısıyla eşleşmeli
    const presXml = await zip.file('ppt/presentation.xml')!.async('string');
    expect(presXml.match(/<p:sldId\b/g) ?? []).toHaveLength(specs.length);

    // [Content_Types].xml'de silinen şablon slaytlarının izi kalmamalı
    const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
    const declared = contentTypes.match(/PartName="\/ppt\/slides\/slide\d+\.xml"/g) ?? [];
    expect(declared).toHaveLength(specs.length);
  }, 60_000);

  it('başlık, KPI ve satır metinleri slayta gerçekten yazılır', async () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Furkan Kızılkurt', summary, rows: rows(2, 'Damat') }]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);
    const slideName = Object.keys(zip.files).find((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))!;
    const xml = await zip.file(slideName)!.async('string');

    expect(xml).toContain('TAKİP LİSTESİ — FURKAN KIZILKURT PORTFÖYÜ');
    expect(xml).toContain('Güncel durum: 16 Eylül 2026');
    expect(xml).toContain('Açık Takip');
    expect(xml).toContain('Toplam Adet');
    expect(xml).toContain('Yakın Vadeli Takip');
    expect(xml).toContain('Çözüm Tarihi');
    expect(xml).toContain('Damat 1');
    expect(xml).toContain('1 Eki 2026');
  }, 60_000);

  // 16.09'da örnek dosya üretilince yakalanan iki hata — tekrarlamasın diye kilitlendi.
  it('slaytlar birbirine karışmaz: her slaytta yalnız kendi kişisinin satırları olur', async () => {
    const specs = buildFollowupSlideSpecs([
      { owner: 'Cem Koç', summary, rows: rows(2, 'CemFirma') },
      { owner: 'Furkan Kızılkurt', summary, rows: rows(2, 'FurkanFirma') },
    ]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    const xmls = await Promise.all(slideNames.map((name) => zip.file(name)!.async('string')));

    const cemSlide = xmls.find((xml) => xml.includes('CEM KOÇ PORTFÖYÜ'))!;
    const furkanSlide = xmls.find((xml) => xml.includes('FURKAN KIZILKURT PORTFÖYÜ'))!;
    expect(cemSlide).toBeDefined();
    expect(furkanSlide).toBeDefined();
    expect(cemSlide).not.toContain('FurkanFirma');
    expect(furkanSlide).not.toContain('CemFirma');
  }, 60_000);

  it('şablonun kendi metinleri slaytta kalmaz (üstü örtülmez, silinir)', async () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Cem Koç', summary, rows: rows(1) }]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);
    const slideName = Object.keys(zip.files).find((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))!;
    const xml = await zip.file(slideName)!.async('string');
    expect(xml).not.toContain('Haftalık Yönetim Güncellemesi');
    // Şablon tek boş slayt olduğu için artık silinecek şablon metni de yok.
  }, 60_000);

  it('kaydı olmayan kişinin slaydında "kayıt bulunmuyor" yazar', async () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Cem Koç', summary: { ...summary, openFollowupCount: 0 }, rows: [] }]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);
    const slideName = Object.keys(zip.files).find((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))!;
    const xml = await zip.file(slideName)!.async('string');
    expect(xml).toContain('Bu portföyde açık takip kaydı bulunmuyor.');
  }, 60_000);

  // 16.09: PowerPoint "biçimini okuyamaz" dedi, LibreOffice ve python-pptx açıyordu.
  // Sebep: silinen şablon slaytlarının grafikleri/SVG'leri ve notesMaster'ın teması pakette
  // ÖKSÜZ kalıyordu ([Content_Types].xml'de tanımlı ama hiçbir ilişki göstermiyor).
  // Bu test paketi kökten gezip erişilemeyen parça kalmadığını doğrular.
  it('pakette öksüz parça kalmaz — PowerPoint OPC doğrulaması bunu reddediyor', async () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Furkan Kızılkurt', summary, rows: rows(3) }]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);

    const names = new Set(Object.keys(zip.files).filter((name) => !zip.files[name].dir));
    const relsPathFor = (part: string) => {
      const index = part.lastIndexOf('/');
      const dir = index < 0 ? '' : part.slice(0, index);
      const base = index < 0 ? part : part.slice(index + 1);
      return dir ? `${dir}/_rels/${base}.rels` : `_rels/${base}.rels`;
    };
    const resolve = (base: string, target: string) => {
      const parts = (base ? `${base}/${target}` : target).split('/');
      const out: string[] = [];
      for (const piece of parts) {
        if (piece === '.' || piece === '') continue;
        if (piece === '..') out.pop();
        else out.push(piece);
      }
      return out.join('/');
    };

    const reachable = new Set<string>();
    const queue: string[] = [];
    const walk = async (relsPath: string, base: string) => {
      if (!names.has(relsPath)) return;
      const xml = await zip.file(relsPath)!.async('string');
      for (const match of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
        const tag = match[0];
        if (/TargetMode="External"/.test(tag)) continue;
        const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
        if (!target || /^(https?:|mailto:)/i.test(target)) continue;
        const resolved = resolve(base, target);
        if (!names.has(resolved) || reachable.has(resolved)) continue;
        reachable.add(resolved);
        queue.push(resolved);
      }
    };
    await walk('_rels/.rels', '');
    while (queue.length) {
      const part = queue.pop()!;
      const index = part.lastIndexOf('/');
      await walk(relsPathFor(part), index < 0 ? '' : part.slice(0, index));
    }

    const orphans = Array.from(names).filter(
      (name) => name !== '[Content_Types].xml' && !name.endsWith('.rels') && !reachable.has(name),
    );
    expect(orphans).toEqual([]);

    // Ters yön: [Content_Types].xml'de tanımlı olup pakette bulunmayan parça da olmamalı.
    const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
    const declared = Array.from(contentTypes.matchAll(/PartName="([^"]+)"/g)).map((m) => m[1].replace(/^\//, ''));
    expect(declared.filter((part) => !names.has(part))).toEqual([]);
  }, 60_000);

  // 16.09, ASIL KÖK NEDEN: boş metinli kutular `<a:r><a:t></a:t></a:r>` yani içi boş run
  // üretiyordu; PowerPoint dosyayı açmayı reddediyordu. LibreOffice, python-pptx ve XML
  // doğrulayıcıları bunu kabul ettiği için ancak Sinan'ın PowerPoint'inde görüldü ve
  // ikili aramayla bulundu (metinli kutu açılıyor, boş metinli kutu bozuyor).
  // Zemin kapatma, lacivert bant ve KPI kartı arka planları hep boş metinlidir.
  it('boş metinli kutular içi boş run üretmez — PowerPoint bunu reddediyor', async () => {
    const specs = buildFollowupSlideSpecs([
      { owner: 'Furkan Kızılkurt', summary, rows: rows(4) },
      { owner: 'Cem Koç', summary: { ...summary, openFollowupCount: 0 }, rows: [] },
    ]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slideNames.length).toBeGreaterThan(0);
    for (const name of slideNames) {
      const xml = await zip.file(name)!.async('string');
      expect(xml).not.toMatch(/<a:t><\/a:t>/);
      expect(xml).not.toMatch(/<a:t\/>/);
      // Dolgu kutuları hâlâ çizilmeli: paragraf var ama run yok.
      expect(xml).toContain('<a:endParaRPr');
    }
  }, 60_000);

  // 16.09 — ASIL KÖK NEDEN ve alınan ders.
  // "PowerPoint biçimini okuyamaz" hatasının sebebi DrawingML ŞEMA ARALIĞI ihlaliydi:
  // yalnız dolgu için kullanılan görünmez kutularda `fontSize: 1` yazıyordu → `sz="1"`.
  // `sz` (ST_TextFontSize) yüzde bir punto birimindedir, geçerli aralık 100–400000'dir.
  // LibreOffice, python-pptx ve XML doğrulayıcıları aralığı denetlemediği için hata yalnız
  // gerçek PowerPoint'te görünüyordu; iki yanlış hipotezden (öksüz parça, boş run) sonra
  // ikili aramayla bulundu. Bu test tek bir değeri değil, ARALIK İHLALİ SINIFINI kapatır.
  it('DrawingML şema aralıkları ve şekil id benzersizliği bozulmaz', async () => {
    const specs = buildFollowupSlideSpecs([
      { owner: 'Furkan Kızılkurt', summary, rows: rows(25) },
      { owner: 'Cem Koç', summary: { ...summary, openFollowupCount: 0 }, rows: [] },
    ]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);

    const ranges: Array<[string, number, number]> = [
      ['sz', 100, 400000],           // yazı boyutu — bu oturumda dosyayı bozan alan
      ['w', 0, 20116800],            // a:ln çizgi kalınlığı
      ['cx', 0, 27273042329600],     // a:ext genişlik
      ['cy', 0, 27273042329600],     // a:ext yükseklik
      ['lIns', 0, 51206400], ['rIns', 0, 51206400],
      ['tIns', 0, 51206400], ['bIns', 0, 51206400],
    ];

    const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slideNames.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const name of slideNames) {
      const xml = await zip.file(name)!.async('string');
      for (const [attr, min, max] of ranges) {
        for (const match of xml.matchAll(new RegExp(`\\b${attr}="(-?\\d+)"`, 'g'))) {
          const value = Number(match[1]);
          if (value < min || value > max) violations.push(`${name}: ${attr}="${value}" (geçerli ${min}..${max})`);
        }
      }
      const ids = Array.from(xml.matchAll(/<p:cNvPr id="(\d+)"/g)).map((m) => Number(m[1]));
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length) violations.push(`${name}: tekrar eden şekil id ${[...new Set(duplicates)].join(', ')}`);
      if (ids.some((id) => id < 1)) violations.push(`${name}: şekil id < 1`);
    }
    expect(violations).toEqual([]);
  }, 60_000);

  it('slayt boş listeyle çağrılamaz', async () => {
    await expect(assembleFollowupDeck(await loadTemplate(), [], new Date())).rejects.toThrow();
  }, 60_000);
});
