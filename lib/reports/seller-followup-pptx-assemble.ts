// Takip Listesi sunumunun PAKET kurgusu: şablonu açar, her slayt için bir kopya
// oluşturur, çizimi yapıştırır, şablonun kendi slaytlarını siler.
//
// 'server-only' YOKTUR ve DB'ye dokunmaz — böylece hem sunucu rotası hem de örnek
// dosya üreten betikler/testler aynı kodu çalıştırabilir (altın kural 11 ve 17).

import JSZip from 'jszip';
import { duplicateSlideAfter, pruneOrphanParts, removeSlide, sanitizePresentationPackage } from '@/lib/pptx/ooxml';
import { buildFollowupSlideXml } from '@/lib/reports/seller-followup-pptx-draw';
import type { FollowupSlideSpec } from '@/lib/reports/seller-followup-pptx-shared';

export async function assembleFollowupDeck(
  templateBuffer: Buffer | Uint8Array,
  specs: FollowupSlideSpec[],
  today = new Date(),
): Promise<Buffer> {
  if (!specs.length) throw new Error('Sunum için slayt bulunamadı (takip listesi boş).');
  const zip = await JSZip.loadAsync(templateBuffer);

  // Şablondaki mevcut slayt numaraları — sonunda hepsi silinir, yalnız ürettiklerimiz kalır.
  const originalSlideNos = Object.keys(zip.files)
    .map((name) => name.match(/^ppt\/slides\/slide(\d+)\.xml$/))
    .filter((match): match is RegExpMatchArray => match != null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  if (!originalSlideNos.length) throw new Error('PPTX şablonunda slayt bulunamadı.');

  // Her slayt DAİMA bozulmamış şablon slaydından çoğaltılır. Bir öncekinden çoğaltmak,
  // o slayda çizilmiş içeriğin de kopyalanmasına yol açıyordu (16.09'da örnek dosya
  // üretilince yakalandı: 2. slaytta 1. kişinin satırları da duruyordu).
  //
  // duplicateSlideAfter kopyayı kaynağın hemen ARDINA koyduğu için liste TERSTEN işlenir;
  // böylece hepsi şablon slaydının ardına sırayla dizilir ve kişi sırası korunur.
  const baseSlideNo = originalSlideNos[0];
  let nextId = 900;
  for (let index = specs.length - 1; index >= 0; index -= 1) {
    const slideNo = await duplicateSlideAfter(zip, baseSlideNo);
    if (slideNo == null) throw new Error('PPTX slaydı çoğaltılamadı.');
    const fileName = `ppt/slides/slide${slideNo}.xml`;
    const file = zip.file(fileName);
    if (!file) throw new Error(`PPTX slaydı bulunamadı: ${fileName}`);
    const drawn = buildFollowupSlideXml(specs[index], nextId, today);
    nextId = drawn.nextId;
    // Şablon slaydının KENDİ şekilleri silinir (üstünü örtmek yetmiyordu: metin dosyada
    // kalıyor, arama/erişilebilirlikte görünüyordu). Grup özellikleri korunur, gerisi bizim.
    const original = await file.async('string');
    // `<p:grpSpPr>` hem kapanış etiketli hem kendinden kapanan (`<p:grpSpPr/>`) gelebilir —
    // ikisi de karşılandı; boş şablon slaydı kendinden kapanan biçimi kullanıyor.
    const xml = original.replace(
      /(<p:spTree>[\s\S]*?(?:<p:grpSpPr\s*\/>|<\/p:grpSpPr>))[\s\S]*?(<\/p:spTree>)/,
      (_match, head: string, tail: string) => `${head}${drawn.xml}${tail}`,
    );
    if (xml === original) throw new Error('PPTX slayt gövdesi (spTree) bulunamadı.');
    zip.file(fileName, xml);
  }

  for (const slideNo of originalSlideNos) await removeSlide(zip, slideNo);

  await sanitizePresentationPackage(zip);
  // Şablonun 18 slaydı silindiği için onlara ait grafik/SVG'ler ve notesMaster'ın teması
  // pakette öksüz kalıyordu; PowerPoint bunu reddediyor ("biçimini okuyamaz"). Temizlik
  // sanitize'dan SONRA yapılır: önce ölü ilişkiler gider, sonra erişilemez parçalar.
  await pruneOrphanParts(zip);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
