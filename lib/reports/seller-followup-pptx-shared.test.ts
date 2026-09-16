import { describe, expect, it } from 'vitest';
import {
  FOLLOWUP_ROWS_PER_SLIDE,
  buildFollowupSlideSpecs,
  followupDeckTitle,
  followupPptxFileName,
  followupSubtitle,
  formatFollowupDate,
  nearTermSubLabel,
  type FollowupSlideRow,
} from './seller-followup-pptx-shared';

const summary = {
  openFollowupCount: 23,
  totalQuantity: 1275,
  nearTermQuantity: 640,
  nearTermCustomers: ['Damat', 'Gusto', 'Spx'],
  nearTermLabel: 'Ağustos–Ekim',
};

function makeRows(count: number): FollowupSlideRow[] {
  return Array.from({ length: count }, (_, index) => ({
    musteri: `Firma ${index + 1}`,
    konuKimde: 'Müşteri',
    modelAdetLabel: 'A80: 10',
    takipKonusu: 'Muafiyet bekleniyor',
    cozumTarihi: '2026-10-01',
  }));
}

describe('Takip Listesi sunumu — başlık ve etiketler (16.09)', () => {
  it('başlığı örnek sunumdaki biçimde büyük harfle kurar', () => {
    expect(followupDeckTitle('Furkan Kızılkurt')).toBe('TAKİP LİSTESİ — FURKAN KIZILKURT PORTFÖYÜ');
  });

  it('kişi seçilmemişse tüm portföy başlığı kullanılır', () => {
    expect(followupDeckTitle('')).toBe('TAKİP LİSTESİ — TÜM PORTFÖY');
  });

  it('alt başlıkta güncel tarihi Türkçe ay adıyla yazar', () => {
    expect(followupSubtitle(new Date(2026, 8, 16))).toBe('Güncel durum: 16 Eylül 2026');
  });

  it('yakın vade etiketinde en fazla üç firma yazar, kalanı +N ile belirtir', () => {
    expect(nearTermSubLabel(summary)).toBe('Ağustos–Ekim: Damat, Gusto, Spx');
    expect(nearTermSubLabel({ ...summary, nearTermCustomers: ['A', 'B', 'C', 'D', 'E'] }))
      .toBe('Ağustos–Ekim: A, B, C +2');
  });

  it('yakın vadede firma yoksa uydurma isim üretmez, yalnız ay aralığını yazar', () => {
    expect(nearTermSubLabel({ ...summary, nearTermCustomers: [] })).toBe('Ağustos–Ekim');
  });

  it('çözüm tarihini kısa ay adıyla biçimler, boşsa tire koyar', () => {
    expect(formatFollowupDate('2026-09-15')).toBe('15 Eyl 2026');
    expect(formatFollowupDate(null)).toBe('—');
    expect(formatFollowupDate('')).toBe('—');
  });

  it('dosya adını Türkçe karakterleri sadeleştirerek kurar', () => {
    expect(followupPptxFileName('Furkan Kızılkurt', new Date(2026, 8, 16)))
      .toBe('takip-listesi-furkan-kizilkurt-2026-09-16.pptx');
    expect(followupPptxFileName('', new Date(2026, 8, 16)))
      .toBe('takip-listesi-hepsi-2026-09-16.pptx');
  });
});

describe('Takip Listesi sunumu — sayfalama (16.09)', () => {
  it('sığan kayıt tek slaytta kalır ve sayfa etiketi taşımaz', () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Furkan Kızılkurt', summary, rows: makeRows(FOLLOWUP_ROWS_PER_SLIDE) }]);
    expect(specs).toHaveLength(1);
    expect(specs[0].pageLabel).toBeNull();
    expect(specs[0].rows).toHaveLength(FOLLOWUP_ROWS_PER_SLIDE);
  });

  it('taşan kayıt sonraki slayta geçer, kırpılmaz (altın kural 19)', () => {
    const total = FOLLOWUP_ROWS_PER_SLIDE + 3;
    const specs = buildFollowupSlideSpecs([{ owner: 'Furkan Kızılkurt', summary, rows: makeRows(total) }]);
    expect(specs).toHaveLength(2);
    expect(specs[0].pageLabel).toBe('1 / 2');
    expect(specs[1].pageLabel).toBe('2 / 2');
    expect(specs[0].rows.length + specs[1].rows.length).toBe(total);
  });

  it('hiç kaydı olmayan kişi de bir slayt alır — sessizce kaybolmaz', () => {
    const specs = buildFollowupSlideSpecs([{ owner: 'Cem Koç', summary: { ...summary, openFollowupCount: 0 }, rows: [] }]);
    expect(specs).toHaveLength(1);
    expect(specs[0].rows).toEqual([]);
    expect(specs[0].owner).toBe('Cem Koç');
  });

  it('"hepsi" indirmesinde kişi sırası korunur', () => {
    const specs = buildFollowupSlideSpecs([
      { owner: 'Cem Koç', summary, rows: makeRows(1) },
      { owner: 'Furkan Kızılkurt', summary, rows: makeRows(FOLLOWUP_ROWS_PER_SLIDE + 1) },
      { owner: 'Ömer Canatar', summary, rows: makeRows(2) },
    ]);
    expect(specs.map((spec) => spec.owner)).toEqual([
      'Cem Koç', 'Furkan Kızılkurt', 'Furkan Kızılkurt', 'Ömer Canatar',
    ]);
  });
});
