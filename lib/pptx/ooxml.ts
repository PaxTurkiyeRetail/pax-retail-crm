// PPTX (OOXML) ARAC KUTUSU — saf; DB'ye, 'server-only'ye ve rapor verisine dokunmaz.
//
// Bu fonksiyonlar 16.09.2026'ya kadar weekly-management-pptx.ts icinde yasiyordu. Takip
// Listesi sunumu da ayni primitifleri kullaninca iki secenek vardi: kopyalamak (altin kural
// 17'ye aykiri) ya da ortak bir module almak. Ikincisi secildi.
//
// Ayrica altin kural 11'i onarir: weekly-management-pptx.ts dolayli olarak 'server-only' ve
// DATABASE_URL isteyen modulleri cekiyordu, bu yuzden ona bagli hicbir sey vitest'te
// yuklenemiyordu. Buradaki kod tamamen saf oldugu icin test edilebilir.
//
// DAVRANIS DEGISMEDI: govdeler birebir tasindi, yalniz export eklendi.

import path from 'node:path';
import JSZip from 'jszip';

export function stripInvalidXmlChars(value: string) {
  // PowerPoint 'Onar' hatasının en sık sebebi CRM notlarından gelen XML 1.0 dışı
  // kontrol karakterleridir. Sekme, satır sonu ve carriage return korunur.
  // Emoji/status ikonları (🟡/🔴/🟢 gibi) geçerli surrogate pair olarak gelir;
  // eski regex tüm surrogate karakterleri sildiği için Kasa Pos Entegrasyon
  // Durumları sayfasındaki ikonlar kayboluyordu. Bu yüzden string'i code point
  // bazında gezip sadece XML 1.0 için geçersiz karakterleri temizliyoruz.
  let clean = '';
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (
      code === 0x09
      || code === 0x0a
      || code === 0x0d
      || (code >= 0x20 && code <= 0xd7ff)
      || (code >= 0xe000 && code <= 0xfffd)
      || (code >= 0x10000 && code <= 0x10ffff)
    ) {
      clean += char;
    }
  }
  return clean;
}

export function escapeXml(value: string) {
  return stripInvalidXmlChars(String(value ?? ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatNumber(value: number) {
  return value.toLocaleString('tr-TR');
}

export function trimText(value: unknown, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

export function truncate(value: string, limit: number) {
  const clean = trimText(value);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function firstChartCacheValue(cacheXml: string) {
  return cacheXml.match(/<c:pt\b[^>]*>[^]*?<c:v>([^]*?)<\/c:v>[^]*?<\/c:pt>/)?.[1] ?? '';
}

export function normalizeChartXmlLiterals(xml: string) {
  // PowerPoint, workbook'u olmayan chart referanslarini (Sheet1!... c:f) bazi
  // surumlerde bozuk paket olarak aciyor. Kalan tum strRef/numRef bloklarini
  // kendi cache verisiyle literal chart dataya ceviriyoruz.
  xml = xml.replace(/<c:tx>\s*<c:strRef>[^]*?<c:strCache>([^]*?)<\/c:strCache>[^]*?<\/c:strRef>\s*<\/c:tx>/g, (_match, cache) => {
    const value = firstChartCacheValue(cache);
    return `<c:tx><c:v>${value || 'Firma'}</c:v></c:tx>`;
  });

  xml = xml.replace(/<c:strRef>[^]*?<c:strCache>([^]*?)<\/c:strCache>[^]*?<\/c:strRef>/g, (_match, cache) => (
    `<c:strLit>${cache}</c:strLit>`
  ));

  xml = xml.replace(/<c:numRef>[^]*?<c:numCache>([^]*?)<\/c:numCache>[^]*?<\/c:numRef>/g, (_match, cache) => (
    `<c:numLit>${cache}</c:numLit>`
  ));

  xml = xml
    .replace(/<c:externalData\b[^>]*\/>/g, '')
    .replace(/<c:externalData\b[^>]*>[^]*?<\/c:externalData>/g, '');

  return xml;
}

export function removeRelationshipByTarget(xml: string, target: string) {
  return xml.replace(/<Relationship\b[^>]*\/>/g, (tag) => (tag.includes(`Target="${target}"`) ? '' : tag));
}

export function getRelationshipIdByTarget(xml: string, target: string) {
  const relMatch = xml.match(/<Relationship\b[^>]*\/>/g)?.find((tag) => tag.includes(`Target="${target}"`));
  return relMatch?.match(/\bId="([^"]+)"/)?.[1] ?? '';
}

export async function removeSlide(zip: JSZip, slideNo: number) {
  const slidePath = `ppt/slides/slide${slideNo}.xml`;
  const relPath = `ppt/slides/_rels/slide${slideNo}.xml.rels`;

  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  let slideRelId = '';
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    slideRelId = getRelationshipIdByTarget(relsXml, `slides/slide${slideNo}.xml`);
    zip.file('ppt/_rels/presentation.xml.rels', removeRelationshipByTarget(relsXml, `slides/slide${slideNo}.xml`));
  }

  if (slideRelId) {
    const presFile = zip.file('ppt/presentation.xml');
    if (presFile) {
      let presXml = await presFile.async('string');
      presXml = presXml.replace(/<p:sldId\b[^>]*\/>/g, (tag) => (tag.includes(`r:id=\"${slideRelId}\"`) ? '' : tag));
      zip.file('ppt/presentation.xml', presXml);
    }
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ctXml = await ctFile.async('string');
    ctXml = ctXml.replace(/<Override\b[^>]*\/>/g, (tag) => (tag.includes(`PartName=\"/ppt/slides/slide${slideNo}.xml\"`) ? '' : tag));
    zip.file('[Content_Types].xml', ctXml);
  }

  zip.remove(slidePath);
  zip.remove(relPath);
}

export async function duplicateSlideAfter(zip: JSZip, sourceSlideNo: number) {
  const slideFiles = Object.keys(zip.files)
    .map((name) => {
      const match = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null);
  const nextSlideNo = (slideFiles.length ? Math.max(...slideFiles) : sourceSlideNo) + 1;
  const sourceSlidePath = `ppt/slides/slide${sourceSlideNo}.xml`;
  const sourceRelPath = `ppt/slides/_rels/slide${sourceSlideNo}.xml.rels`;
  const sourceSlideFile = zip.file(sourceSlidePath);
  if (!sourceSlideFile) return null;

  const sourceSlide = await sourceSlideFile.async('string');
  zip.file(`ppt/slides/slide${nextSlideNo}.xml`, sourceSlide);

  const sourceRelsFile = zip.file(sourceRelPath);
  if (sourceRelsFile) {
    let sourceRels = await sourceRelsFile.async('string');
    sourceRels = sourceRels.replace(/<Relationship\b[^>]*(?:notesSlide|comments|threadedComment)[^>]*\/>/g, '');
    zip.file(`ppt/slides/_rels/slide${nextSlideNo}.xml.rels`, sourceRels);
  }

  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const presFile = zip.file('ppt/presentation.xml');
  const ctFile = zip.file('[Content_Types].xml');
  if (!relsFile || !presFile || !ctFile) return nextSlideNo;

  let relsXml = await relsFile.async('string');
  const relIds = Array.from(relsXml.matchAll(/\bId="rId(\d+)"/g)).map((m) => Number(m[1]));
  const nextRelId = `rId${(relIds.length ? Math.max(...relIds) : 0) + 1}`;
  const sourceRelTag = relsXml.match(/<Relationship\b[^>]*\/>/g)?.find((tag) => tag.includes(`Target="slides/slide${sourceSlideNo}.xml"`)) ?? '';
  if (!sourceRelTag) return nextSlideNo;

  const nextRelTag = sourceRelTag
    .replace(/\bId="[^"]+"/, `Id="${nextRelId}"`)
    .replace(`slides/slide${sourceSlideNo}.xml`, `slides/slide${nextSlideNo}.xml`);
  relsXml = relsXml.replace('</Relationships>', `${nextRelTag}</Relationships>`);
  zip.file('ppt/_rels/presentation.xml.rels', relsXml);

  let presXml = await presFile.async('string');
  const slideIdNums = Array.from(presXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)).map((m) => Number(m[1]));
  const nextSlideId = (slideIdNums.length ? Math.max(...slideIdNums) : 255) + 1;
  const nextSldTag = `<p:sldId id="${nextSlideId}" r:id="${nextRelId}"/>`;
  const sourceRelId = sourceRelTag.match(/\bId="([^"]+)"/)?.[1] ?? '';
  const sourceSlideTag = sourceRelId ? presXml.match(new RegExp(`<p:sldId\\b[^>]*r:id="${escapeRegExp(sourceRelId)}"[^>]*/>`))?.[0] : '';
  if (sourceSlideTag) presXml = presXml.replace(sourceSlideTag, `${sourceSlideTag}${nextSldTag}`);
  else presXml = presXml.replace('</p:sldIdLst>', `${nextSldTag}</p:sldIdLst>`);
  zip.file('ppt/presentation.xml', presXml);

  let ctXml = await ctFile.async('string');
  const overrideTag = `<Override PartName="/ppt/slides/slide${nextSlideNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  if (!ctXml.includes(`PartName="/ppt/slides/slide${nextSlideNo}.xml"`)) {
    ctXml = ctXml.replace('</Types>', `${overrideTag}</Types>`);
  }
  zip.file('[Content_Types].xml', ctXml);
  return nextSlideNo;
}

export function resolveRelationshipTarget(relFileName: string, target: string) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  // Root rels dosyası (_rels/.rels) için base dizin yoktur. Alt paket rels
  // dosyalarında ise /_rels/<owner>.rels kısmı kaldırılıp owner dizinine dönülür.
  const baseDir = relFileName.includes('/_rels/')
    ? relFileName.replace(/\/_rels\/[^/]+\.rels$/, '/')
    : '';
  return path.posix.normalize(`${baseDir}${target}`);
}

export function relationshipTargetsExistingPart(zip: JSZip, relFileName: string, target: string, targetMode?: string) {
  if (!target || targetMode === 'External' || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) return true;
  return zip.file(resolveRelationshipTarget(relFileName, target)) != null;
}

export function presentationSlideCountFromXml(presXml: string) {
  return (presXml.match(/<p:sldId\b[^>]*\/>/g) ?? []).length;
}

export async function removePowerPointAuxiliaryParts(zip: JSZip) {
  // Notes, comments and custom slide sections are not needed in generated export.
  // When slides are removed/duplicated, these optional parts can keep stale slide
  // ids/relationships and make PowerPoint show the "Onar" warning.
  for (const name of Object.keys(zip.files)) {
    if (
      /^ppt\/notesSlides\//.test(name)
      || /^ppt\/notesMasters\//.test(name)
      || /^ppt\/comments\//.test(name)
      || /^ppt\/threadedComments\//.test(name)
      || /^ppt\/commentAuthors\.xml$/.test(name)
      || /^ppt\/people\//.test(name)
    ) {
      zip.remove(name);
    }
  }

  for (const name of Object.keys(zip.files).filter((item) => item.endsWith('.rels'))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*(?:notesSlide|notesMaster|comments|commentAuthors|threadedComment|person)[^>]*\/>/g, '');
    zip.file(name, relXml);
  }

  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    let presXml = await presFile.async('string');
    presXml = presXml
      .replace(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/g, '')
      .replace(/<p:sectionLst>[\s\S]*?<\/p:sectionLst>/g, '')
      .replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/g, '')
      .replace(/<p:photoAlbum>[\s\S]*?<\/p:photoAlbum>/g, '');
    zip.file('ppt/presentation.xml', presXml);
  }
}

export async function sanitizeXmlParts(zip: JSZip) {
  for (const name of Object.keys(zip.files).filter((item) => item.endsWith('.xml') || item.endsWith('.rels'))) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    const clean = stripInvalidXmlChars(xml);
    if (clean !== xml) zip.file(name, clean);
  }
}

export async function removeChartEmbeddedWorkbookLinks(zip: JSZip) {
  // PowerPoint repair warning fix:
  // The template charts keep embedded Excel workbook links under c:externalData.
  // We update chart cache XML directly, so those workbook relations become stale.
  // Removing only the external workbook links lets PowerPoint open the generated
  // PPTX without asking for "Onar" while preserving the rendered chart data.
  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/charts\/chart\d+\.xml$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    let chartXml = await file.async('string');
    chartXml = normalizeChartXmlLiterals(chartXml);
    zip.file(name, chartXml);
  }

  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/charts\/_rels\/chart\d+\.xml\.rels$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/package"[^>]*\/>/g, '');
    relXml = relXml.replace(/<Relationship\b[^>]*Target="[^"]*\/embeddings\/[^"]*"[^>]*\/>/g, '');
    zip.file(name, relXml);
  }

  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/embeddings\//.test(item))) {
    zip.remove(name);
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile && !Object.keys(zip.files).some((item) => item.endsWith('.xlsx'))) {
    let ctXml = await ctFile.async('string');
    ctXml = ctXml.replace(/<Default\b[^>]*Extension="xlsx"[^>]*\/>/g, '');
    zip.file('[Content_Types].xml', ctXml);
  }
}

export async function updateExtendedProperties(zip: JSZip) {
  const appFile = zip.file('docProps/app.xml');
  const presFile = zip.file('ppt/presentation.xml');
  if (!appFile || !presFile) return;

  const presXml = await presFile.async('string');
  const slideCount = presentationSlideCountFromXml(presXml);
  let appXml = await appFile.async('string');
  const setTag = (xml: string, tag: string, value: string) => {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`);
    return re.test(xml) ? xml.replace(re, `<${tag}>${value}</${tag}>`) : xml;
  };

  appXml = setTag(appXml, 'Slides', String(slideCount));
  appXml = setTag(appXml, 'Notes', '0');
  appXml = setTag(appXml, 'HiddenSlides', '0');

  appXml = appXml.replace(
    /(<vt:lpstr>Slayt Başlıkları<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>)(\d+)(<\/vt:i4>)/,
    `$1${slideCount}$3`,
  );
  appXml = appXml.replace(
    /(<vt:lpstr>Slide Titles<\/vt:lpstr>\s*<\/vt:variant>\s*<vt:variant>\s*<vt:i4>)(\d+)(<\/vt:i4>)/,
    `$1${slideCount}$3`,
  );

  const titleMatch = appXml.match(/<TitlesOfParts>[\s\S]*?<vt:vector[^>]*>[\s\S]*?<\/vt:vector>[\s\S]*?<\/TitlesOfParts>/);
  if (titleMatch) {
    const currentItems = Array.from(titleMatch[0].matchAll(/<vt:lpstr>([\s\S]*?)<\/vt:lpstr>/g)).map((m) => m[1]);
    const prefix = currentItems.slice(0, Math.min(6, currentItems.length));
    while (prefix.length < 6) prefix.push(prefix.length === 5 ? 'Office Theme' : 'Arial');
    const items = [...prefix, ...Array.from({ length: slideCount }, () => 'PowerPoint Sunusu')];
    const vector = `<TitlesOfParts><vt:vector size="${items.length}" baseType="lpstr">${items.map((item) => `<vt:lpstr>${escapeXml(item)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>`;
    appXml = appXml.replace(titleMatch[0], vector);
  }

  zip.file('docProps/app.xml', appXml);
}

export async function sanitizePresentationPackage(zip: JSZip) {
  await removePowerPointAuxiliaryParts(zip);
  await removeChartEmbeddedWorkbookLinks(zip);
  await sanitizeXmlParts(zip);
  const slidePathSet = new Set(Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)));

  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (relsFile) {
    let relsXml = await relsFile.async('string');
    relsXml = relsXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      if (type.endsWith('/slide')) {
        return slidePathSet.has(`ppt/${target}`) ? tag : '';
      }
      return relationshipTargetsExistingPart(zip, 'ppt/_rels/presentation.xml.rels', target, targetMode) ? tag : '';
    });
    zip.file('ppt/_rels/presentation.xml.rels', relsXml);
  }

  const validSlideRelIds = new Set<string>();
  const relsFileAfter = zip.file('ppt/_rels/presentation.xml.rels');
  if (relsFileAfter) {
    const relsXml = await relsFileAfter.async('string');
    for (const tag of relsXml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const relId = tag.match(/\bId="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      if (type.endsWith('/slide') && relId && slidePathSet.has(`ppt/${target}`)) validSlideRelIds.add(relId);
    }
  }

  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    let presXml = await presFile.async('string');
    const seenSlideIds = new Set<string>();
    presXml = presXml.replace(/<p:sldId\b[^>]*\/>/g, (tag) => {
      const relId = tag.match(/\br:id="([^"]+)"/)?.[1] ?? '';
      const slideId = tag.match(/\bid="([^"]+)"/)?.[1] ?? '';
      if (!relId || !validSlideRelIds.has(relId) || seenSlideIds.has(slideId)) return '';
      seenSlideIds.add(slideId);
      return tag;
    });
    presXml = presXml
      .replace(/<p:sectionLst>[\s\S]*?<\/p:sectionLst>/g, '')
      .replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/g, '')
      .replace(/<p:photoAlbum>[\s\S]*?<\/p:photoAlbum>/g, '');
    zip.file('ppt/presentation.xml', presXml);
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ctXml = await ctFile.async('string');
    const seen = new Set<string>();
    ctXml = ctXml.replace(/<Override\b[^>]*\/>/g, (tag) => {
      const partName = tag.match(/\bPartName="([^"]+)"/)?.[1] ?? '';
      const contentType = tag.match(/\bContentType="([^"]+)"/)?.[1] ?? '';
      if (contentType === 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml') {
        const zipPath = partName.replace(/^\//, '');
        if (!slidePathSet.has(zipPath) || seen.has(partName)) return '';
        seen.add(partName);
      }
      return tag;
    });
    zip.file('[Content_Types].xml', ctXml);
  }

  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      if (/(notesSlide|comments|threadedComment)/.test(type)) return '';
      return relationshipTargetsExistingPart(zip, name, target, targetMode) ? tag : '';
    });
    zip.file(name, relXml);
  }

  // PowerPoint'teki "Onar" uyarısının önemli nedeni, silinen slaytlardan kalan
  // notesSlide/comment ilişkileridir. Template'ten sayfa kaldırınca not sayfaları ve
  // rel dosyaları pakette orphan kalabiliyor; Office bunu bozuk paket olarak algılıyor.
  const referencedNoteSlides = new Set<string>();
  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(item))) {
    const file = zip.file(name);
    if (!file) continue;
    const relXml = await file.async('string');
    for (const tag of relXml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
      const type = tag.match(/\bType="([^"]+)"/)?.[1] ?? '';
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      if (type.endsWith('/notesSlide') && targetMode !== 'External') {
        referencedNoteSlides.add(resolveRelationshipTarget(name, target));
      }
    }
  }

  for (const notePath of Object.keys(zip.files).filter((item) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(item))) {
    if (!referencedNoteSlides.has(notePath)) {
      zip.remove(notePath);
      zip.remove(notePath.replace('ppt/notesSlides/', 'ppt/notesSlides/_rels/') + '.rels');
    }
  }

  // Son temizlik: pakette kalan tüm .rels dosyalarında hedefi olmayan ilişkiyi,
  // Content_Types içinde de dosyası silinmiş Override kayıtlarını kaldır.
  for (const name of Object.keys(zip.files).filter((item) => item.endsWith('.rels'))) {
    const file = zip.file(name);
    if (!file) continue;
    let relXml = await file.async('string');
    relXml = relXml.replace(/<Relationship\b[^>]*\/>/g, (tag) => {
      const target = tag.match(/\bTarget="([^"]+)"/)?.[1] ?? '';
      const targetMode = tag.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
      return relationshipTargetsExistingPart(zip, name, target, targetMode) ? tag : '';
    });
    zip.file(name, relXml);
  }

  const finalCtFile = zip.file('[Content_Types].xml');
  if (finalCtFile) {
    let ctXml = await finalCtFile.async('string');
    ctXml = ctXml.replace(/<Override\b[^>]*\/>/g, (tag) => {
      const partName = tag.match(/\bPartName="([^"]+)"/)?.[1] ?? '';
      if (!partName) return tag;
      return zip.file(partName.replace(/^\//, '')) ? tag : '';
    });
    zip.file('[Content_Types].xml', ctXml);
  }

  await updateExtendedProperties(zip);
  await sanitizeXmlParts(zip);
}

/**
 * DrawingML `sz` (ST_TextFontSize) yüzde bir punto birimindedir ve şema aralığı
 * **100–400000**'dir (1pt–4000pt). Aralık dışı değer dosyayı PowerPoint'e açtırmaz
 * ("biçimini okuyamaz"), ama LibreOffice/python-pptx/XML doğrulayıcılar kabul eder.
 *
 * Yalnız dolgu için kullanılan görünmez kutularda `fontSize: 1` yazılıyordu → `sz="1"`,
 * yani şema dışı. Metin taşımadıkları için 1pt'ye yuvarlamak görünümü değiştirmez.
 * (16.09.2026, Sinan'ın PowerPoint'inde ikili aramayla bulundu.)
 */
export function clampFontSize(fontSize: number) {
  const value = Math.round(Number(fontSize));
  if (!Number.isFinite(value)) return 1100;
  return Math.min(400000, Math.max(100, value));
}

export function xmlTextRun(text: string, fontSize = 1100, bold = false, color = '1F2937') {
  fontSize = clampFontSize(fontSize);
  return `<a:r><a:rPr lang="tr-TR" sz="${fontSize}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/><a:cs typeface="Aptos"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>`;
}

export function makeTextBox(
  id: number,
  name: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  text: string,
  options?: { fontSize?: number; bold?: boolean; color?: string; align?: 'l' | 'ctr' | 'r'; fill?: string; line?: string; marginLeft?: number; marginRight?: number },
) {
  const fontSize = clampFontSize(options?.fontSize ?? 1100);
  const color = options?.color ?? '1F2937';
  const fill = options?.fill ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>` : '<a:noFill/>';
  const line = options?.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${options.line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  // BOŞ METİNDE RUN ÜRETİLMEZ (16.09.2026 — Sinan: "PowerPoint biçimini okuyamaz").
  // Metin boşken `<a:r><a:t></a:t></a:r>` yani İÇİ BOŞ bir run çıkıyordu; PowerPoint bunu
  // reddediyor (LibreOffice, python-pptx ve XML doğrulayıcılar kabul ediyor — bu yüzden
  // hata ancak gerçek PowerPoint'te görüldü). Boş kutu doğru biçimde yalnız `<a:endParaRPr>`
  // taşır. Sadece dolgu/çerçeve için kullanılan kutular (zemin kapatma, renk bandı, kart
  // arka planı) hep boş metinlidir; Yönetim Sunumu'ndaki iki "Canvas" kutusu da öyleydi.
  // İkili arama ile bulundu: metinli kutu açılıyor, boş metinli kutu dosyayı bozuyor.
  const runXml = String(text ?? '').length ? xmlTextRun(text, fontSize, options?.bold, color) : '';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${options?.marginLeft ?? 60000}" rIns="${options?.marginRight ?? 60000}" tIns="20000" bIns="20000" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="${options?.align ?? 'l'}"/>${runXml}<a:endParaRPr lang="tr-TR" sz="${fontSize}"/></a:p></p:txBody></p:sp>`;
}

/**
 * ÖKSÜZ PARÇA TEMİZLİĞİ — OPC ilişki grafiğinden erişilemeyen parçaları paketten siler.
 *
 * NEDEN (16.09.2026, Sinan: "PowerPoint biçimini okuyamaz"): Takip Listesi sunumu şablonun
 * 18 slaydını silip kendi slaytlarını üretiyor. Slaytlar gidince onlara ait `ppt/charts/*`
 * ve SVG'ler, `removePowerPointAuxiliaryParts` notesMaster'ı silince de onun teması
 * (`ppt/theme/theme2.xml`) pakette ÖKSÜZ kaldı: `[Content_Types].xml`'de tanımlılar ama
 * hiçbir ilişki onlara işaret etmiyor. PowerPoint OPC paketini doğrularken bunu reddediyor
 * ("biçimini okuyamaz"); LibreOffice ve python-pptx umursamıyor — bu yüzden ilk doğrulama
 * turu hatayı kaçırdı. Şablonun kendisinde öksüz parça 0'dır.
 *
 * `sanitizePresentationPackage` var olmayan parçayı gösteren İLİŞKİLERİ siler; bu fonksiyon
 * ise tersini yapar — hiçbir ilişkinin göstermediği PARÇALARI siler. İkisi tamamlayıcıdır.
 *
 * Erişilebilirlik kökten (`_rels/.rels`) tüm ilişki grafiği gezilerek hesaplandığı için tek
 * geçiş yeterlidir: bir öksüzün zincirindeki her şey zaten erişilemez sayılır.
 *
 * @returns silinen parça yolları (boş dizi = paket zaten temizdi)
 */
export async function pruneOrphanParts(zip: JSZip): Promise<string[]> {
  const names = new Set(Object.keys(zip.files).filter((name) => !zip.files[name].dir));
  const relsPathFor = (part: string) =>
    part ? path.posix.join(path.posix.dirname(part), '_rels', `${path.posix.basename(part)}.rels`) : '_rels/.rels';

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
      const resolved = path.posix.normalize(path.posix.join(base, target));
      if (!names.has(resolved) || reachable.has(resolved)) continue;
      reachable.add(resolved);
      queue.push(resolved);
    }
  };

  await walk('_rels/.rels', '');
  while (queue.length) {
    const part = queue.pop()!;
    await walk(relsPathFor(part), path.posix.dirname(part));
  }

  const orphans = Array.from(names).filter(
    (name) => name !== '[Content_Types].xml' && !name.endsWith('.rels') && !reachable.has(name),
  );
  if (!orphans.length) return [];

  for (const orphan of orphans) {
    zip.remove(orphan);
    const rels = relsPathFor(orphan);
    if (names.has(rels)) zip.remove(rels);
  }

  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    const drop = new Set(orphans.map((name) => `/${name}`));
    const ctXml = (await ctFile.async('string')).replace(/<Override\b[^>]*\/>/g, (tag) => {
      const partName = tag.match(/\bPartName="([^"]+)"/)?.[1] ?? '';
      return drop.has(partName) ? '' : tag;
    });
    zip.file('[Content_Types].xml', ctXml);
  }
  return orphans;
}
