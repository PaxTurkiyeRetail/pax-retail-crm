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
  return fs.readFile(path.join(process.cwd(), 'templates', 'weekly-management-template.pptx'));
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
  }, 60_000);

  it('kaydı olmayan kişinin slaydında "kayıt bulunmuyor" yazar', async () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Cem Koç', summary: { ...summary, openFollowupCount: 0 }, rows: [] }]);
    const buffer = await assembleFollowupDeck(await loadTemplate(), specs, new Date(2026, 8, 16));
    const zip = await JSZip.loadAsync(buffer);
    const slideName = Object.keys(zip.files).find((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))!;
    const xml = await zip.file(slideName)!.async('string');
    expect(xml).toContain('Bu portföyde açık takip kaydı bulunmuyor.');
  }, 60_000);

  it('slayt boş listeyle çağrılamaz', async () => {
    await expect(assembleFollowupDeck(await loadTemplate(), [], new Date())).rejects.toThrow();
  }, 60_000);
});
