// Takip Listesi slaytının XML çizimi — SAF (DB yok, 'server-only' yok).
//
// Ayrı dosya olmasının sebebi: çizim mantığı testten ve örnek dosya üretiminden
// geçebilsin. `seller-followup-pptx.ts` yalnız veriyi çekip bu modülü çağırır,
// `-shared.ts` ise istemci tarafından da kullanıldığı için hafif kalır (fs/jszip almaz).
//
// Tasarım kaynağı: Sinan'ın 27.08 tarihli örnek sunumları (Furkan/Cem/Ömer Özet.pptx).
// Ölçüler ve renkler o dosyaların slide XML'inden okundu.
//
// ÇİZİM YÖNTEMİ: proje PPTX'te gerçek tablo nesnesi kullanmıyor; ızgara konumlandırılmış
// metin kutularıyla çiziliyor (bkz. injectSegmentTable). Aynı desen izlendi; `makeTextBox`,
// `truncate` ve `formatNumber` weekly-management-pptx.ts'ten yeniden kullanılır, kopyalanmaz.

import { formatNumber, makeTextBox, truncate } from '@/lib/pptx/ooxml';
import { followupSubtitle, formatFollowupDate, nearTermSubLabel, type FollowupSlideSpec } from '@/lib/reports/seller-followup-pptx-shared';

export const SLIDE_W = 12192000;
export const SLIDE_H = 6858000;

/** Örnek sunumdan okunan PAX paleti. */
export const COLOR = {
  navy: '1E2761',
  navySoft: 'CADCFC',
  cardFill: 'F4F6FA',
  cardLine: 'E2E8F0',
  value: '1E2761',
  label: '2D3748',
  sub: '5A6B7B',
  white: 'FFFFFF',
  cellText: '1F2937',
  cellLine: 'E2E8F0',
  rowAlt: 'F8FAFC',
} as const;

const LAYOUT = {
  barH: 914400,
  margin: 457200,
  contentW: 11274552,
  titleY: 91440,
  titleH: 457200,
  subtitleY: 530352,
  subtitleH: 292608,
  cardY: 1024128,
  cardW: 3611880,
  cardH: 749808,
  cardXs: [457200, 4288536, 8119872],
  cardPad: 137160,
  cardInnerW: 3337560,
  valueY: 1078992,
  valueH: 384048,
  labelY: 1444752,
  labelH: 182880,
  subY: 1609344,
  subH: 155448,
  tableTop: 1956816,
  headerH: 300000,
  rowH: 190000,
} as const;

export const COLUMNS = [
  { header: 'Müşteri', width: 2300000, limit: 26, align: 'l' as const },
  { header: 'Konu Kimde', width: 1500000, limit: 17, align: 'l' as const },
  { header: 'Model / Adet', width: 2200000, limit: 25, align: 'l' as const },
  { header: 'Takip Konusu', width: 3974552, limit: 46, align: 'l' as const },
  { header: 'Çözüm Tarihi', width: 1300000, limit: 14, align: 'ctr' as const },
];

/** Tablonun alt kenarı slayt içinde kalmalı — sayfalama sabitinin emniyet kontrolü. */
export function followupTableBottom(rowCount: number) {
  return LAYOUT.tableTop + LAYOUT.headerH + rowCount * LAYOUT.rowH;
}

/**
 * Bir slaydın `<p:spTree>` içine eklenecek şekil XML'ini üretir.
 * @returns xml ve bir sonraki kullanılabilir şekil id'si
 */
export function buildFollowupSlideXml(spec: FollowupSlideSpec, startId: number, today: Date) {
  const parts: string[] = [];
  let id = startId;

  // Şablon slaydının kendi içeriğini kapat — üstüne kendi düzenimizi çiziyoruz.
  parts.push(makeTextBox(id++, `FollowupCanvas_${startId}`, 0, 0, SLIDE_W, SLIDE_H, '', {
    fontSize: 1, color: COLOR.white, fill: COLOR.white, line: COLOR.white, marginLeft: 0, marginRight: 0,
  }));

  // Lacivert başlık bandı
  parts.push(makeTextBox(id++, `FollowupBar_${startId}`, 0, 0, SLIDE_W, LAYOUT.barH, '', {
    fontSize: 1, color: COLOR.navy, fill: COLOR.navy, line: COLOR.navy, marginLeft: 0, marginRight: 0,
  }));
  parts.push(makeTextBox(id++, `FollowupTitle_${startId}`, LAYOUT.margin, LAYOUT.titleY, LAYOUT.contentW, LAYOUT.titleH, spec.title, {
    fontSize: 2200, bold: true, color: COLOR.white, marginLeft: 0, marginRight: 0,
  }));
  const subtitle = spec.pageLabel
    ? `${followupSubtitle(today)} · sayfa ${spec.pageLabel}`
    : followupSubtitle(today);
  parts.push(makeTextBox(id++, `FollowupSubtitle_${startId}`, LAYOUT.margin, LAYOUT.subtitleY, LAYOUT.contentW, LAYOUT.subtitleH, subtitle, {
    fontSize: 1200, color: COLOR.navySoft, marginLeft: 0, marginRight: 0,
  }));

  // Üç KPI kartı — ekrandaki Takip Listesi özetinin aynısı
  const cards = [
    {
      value: formatNumber(spec.summary.openFollowupCount),
      label: 'Açık Takip',
      sub: spec.owner ? `${spec.owner} portföyünde` : 'Tüm portföyde',
    },
    {
      value: formatNumber(spec.summary.totalQuantity),
      label: 'Toplam Adet',
      sub: 'Takip listesindeki hesaplar',
    },
    {
      value: formatNumber(spec.summary.nearTermQuantity),
      label: 'Yakın Vadeli Takip',
      sub: nearTermSubLabel(spec.summary),
    },
  ];
  cards.forEach((card, index) => {
    const x = LAYOUT.cardXs[index];
    const innerX = x + LAYOUT.cardPad;
    parts.push(makeTextBox(id++, `FollowupCard_${startId}_${index}`, x, LAYOUT.cardY, LAYOUT.cardW, LAYOUT.cardH, '', {
      fontSize: 1, color: COLOR.cardFill, fill: COLOR.cardFill, line: COLOR.cardLine, marginLeft: 0, marginRight: 0,
    }));
    parts.push(makeTextBox(id++, `FollowupCardValue_${startId}_${index}`, innerX, LAYOUT.valueY, LAYOUT.cardInnerW, LAYOUT.valueH, card.value, {
      fontSize: 2400, bold: true, color: COLOR.value, marginLeft: 0, marginRight: 0,
    }));
    parts.push(makeTextBox(id++, `FollowupCardLabel_${startId}_${index}`, innerX, LAYOUT.labelY, LAYOUT.cardInnerW, LAYOUT.labelH, card.label, {
      fontSize: 1050, bold: true, color: COLOR.label, marginLeft: 0, marginRight: 0,
    }));
    parts.push(makeTextBox(id++, `FollowupCardSub_${startId}_${index}`, innerX, LAYOUT.subY, LAYOUT.cardInnerW, LAYOUT.subH, truncate(card.sub, 46), {
      fontSize: 800, color: COLOR.sub, marginLeft: 0, marginRight: 0,
    }));
  });

  // Tablo başlığı
  let x = LAYOUT.margin;
  COLUMNS.forEach((column, index) => {
    parts.push(makeTextBox(id++, `FollowupHead_${startId}_${index}`, x, LAYOUT.tableTop, column.width, LAYOUT.headerH, column.header, {
      fontSize: 950, bold: true, color: COLOR.white, align: column.align === 'ctr' ? 'ctr' : 'l',
      fill: COLOR.navy, line: COLOR.navy, marginLeft: 50000, marginRight: 50000,
    }));
    x += column.width;
  });

  // Satırlar
  if (!spec.rows.length) {
    parts.push(makeTextBox(id++, `FollowupEmpty_${startId}`, LAYOUT.margin, LAYOUT.tableTop + LAYOUT.headerH, LAYOUT.contentW, LAYOUT.rowH * 2, 'Bu portföyde açık takip kaydı bulunmuyor.', {
      fontSize: 1000, color: COLOR.sub, align: 'ctr', fill: COLOR.rowAlt, line: COLOR.cellLine,
    }));
  }
  spec.rows.forEach((row, rowIndex) => {
    const y = LAYOUT.tableTop + LAYOUT.headerH + rowIndex * LAYOUT.rowH;
    const values = [
      row.musteri,
      row.konuKimde,
      row.modelAdetLabel,
      row.takipKonusu,
      formatFollowupDate(row.cozumTarihi),
    ];
    let cellX = LAYOUT.margin;
    values.forEach((value, index) => {
      const column = COLUMNS[index];
      parts.push(makeTextBox(id++, `FollowupCell_${startId}_${rowIndex}_${index}`, cellX, y, column.width, LAYOUT.rowH, truncate(String(value || '—'), column.limit), {
        fontSize: 850, color: COLOR.cellText, align: column.align,
        fill: rowIndex % 2 === 0 ? COLOR.white : COLOR.rowAlt, line: COLOR.cellLine,
        marginLeft: 50000, marginRight: 50000,
      }));
      cellX += column.width;
    });
  });

  return { xml: parts.join(''), nextId: id };
}
