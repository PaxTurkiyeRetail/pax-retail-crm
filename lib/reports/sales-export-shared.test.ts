import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildWorkbookBytes, excelDateSerial } from '@/lib/xlsx/simple-workbook';
import {
  defaultPeriodKey,
  deviceLineToRow,
  deviceSheets,
  deviceTotals,
  exportFileName,
  ownerChoices,
  parsePeriodKey,
  periodMonthLabel,
  periodOptions,
  serviceSheets,
  serviceTotals,
  type DeviceSaleLine,
  type ServiceInvoiceLine,
} from './sales-export-shared';

const meta = { period: parsePeriodKey('2026-09')!, owner: '', generatedAt: '21.09.2026 14:00' };

const line = (over: Partial<DeviceSaleLine> = {}): DeviceSaleLine => ({
  sale_id: 's1', sale_date: '2026-09-03', musteri: 'Kiğılı', owner_name: 'Furkan Kızılkurt', source: 'quote',
  quote_no: 'T-2026-001', sales_channel: 'Direkt Satış', note: null,
  line_no: 1, product_code: 'A80', product_name: 'PAX A80', sale_type: 'sale', quantity: 10, unit_price: 120, total_price: 1200,
  rental_monthly_price: null, rental_start_date: null, rental_end_date: null,
  sale_device_count: 10, sale_amount: 1200, ...over,
});

describe('Satış raporları (Excel) — dönem seçimi (Sinan, 21.09: "Ocak ayı gibi ya da 2026 yılı gibi")', () => {
  it('yıl anahtarı yılın tamamı, ay anahtarı ayın ilk–son günü; başka biçim null', () => {
    expect(parsePeriodKey('2026')).toMatchObject({ from: '2026-01-01', to: '2026-12-31', label: '2026 yılı', kind: 'year' });
    expect(parsePeriodKey('2026-01')).toMatchObject({ from: '2026-01-01', to: '2026-01-31', label: 'Ocak 2026', kind: 'month' });
    expect(parsePeriodKey('2026-02')?.to).toBe('2026-02-28');
    expect(parsePeriodKey('2028-02')?.to).toBe('2028-02-29');
    expect(parsePeriodKey('2026-13')).toBeNull();
    expect(parsePeriodKey('eylul')).toBeNull();
    expect(parsePeriodKey('')).toBeNull();
  });
  it('seçici: bu yıl + bu aya kadar aylar (yeni önce), sonra geçen yıl + 12 ay; gelecek ay yok', () => {
    const keys = periodOptions('2026-09-21').map((p) => p.key);
    expect(keys.slice(0, 3)).toEqual(['2026', '2026-09', '2026-08']);
    expect(keys).not.toContain('2026-10');
    expect(keys).toContain('2025');
    expect(keys).toContain('2025-12');
    expect(keys).toContain('2025-01');
    expect(keys).toHaveLength(1 + 9 + 1 + 12);
    expect(defaultPeriodKey('2026-09-21')).toBe('2026-09');
  });
});

describe('Cihaz Satış Raporu — kalemler ve toplamlar', () => {
  // 22.09 (Sinan): Satış Tipi (Teklifli/Direkt), Teklif No ve Not kolonları KALDIRILDI; tutarlar para
  // biçimli sayı ($), tarihler Excel gün seri numarası (GG.AA.YYYY görünür).
  it('kalem satırı: tarih · firma · satışçı · kanal · satış/kiralama · model · ürün · adet · birim · toplam', () => {
    const row = deviceLineToRow(line());
    expect(row).toHaveLength(13);
    expect(row[0]).toEqual({ value: excelDateSerial('2026-09-03'), format: 'date' });
    expect(row.slice(1, 8)).toEqual(['Kiğılı', 'Furkan Kızılkurt', 'Direkt Satış', 'Satış', 'A80', 'PAX A80', 10]);
    expect(row[8]).toEqual({ value: 120, format: 'usd' });
    expect(row[9]).toEqual({ value: 1200, format: 'usd' });
  });
  it('kaldırılan kolonlar Excel satırında hiç yok: Satış Tipi (Teklifli/Direkt), Teklif No, Not', () => {
    const row = deviceLineToRow(line({ source: 'direct', quote_no: 'T-2026-001', note: 'elden teslim' }));
    const text = row.map((cell) => (typeof cell === 'string' ? cell : '')).join('|');
    expect(text).not.toContain('Direkt satış');
    expect(text).not.toContain('Teklifli satış');
    expect(text).not.toContain('T-2026-001');
    expect(text).not.toContain('elden teslim');
    expect(deviceSheets([line()], meta)[0].rows[0]).not.toContain('Satış Tipi');
  });
  it('kiralama satırı: tür ve aylık kira; kira tarihleri de tarih hücresi', () => {
    const row = deviceLineToRow(line({ sale_type: 'rental', rental_monthly_price: 15, rental_start_date: '2026-09-01', rental_end_date: null }));
    expect(row[4]).toBe('Kiralama');
    expect(row[10]).toEqual({ value: 15, format: 'usd' });
    expect(row[11]).toEqual({ value: excelDateSerial('2026-09-01'), format: 'date' });
    expect(row[12]).toBe('');
  });
  it('kalemi olmayan eski satış atlanmaz: başlık adedi/tutarı iner, birim fiyat BOŞ (uydurulmaz)', () => {
    const row = deviceLineToRow(line({ line_no: null, product_code: null, quantity: null, unit_price: null, total_price: null, sale_device_count: 4, sale_amount: 900 }));
    expect(row[5]).toBe('—');
    expect(row[7]).toBe(4);
    expect(row[8]).toBe('');
    expect(row[9]).toEqual({ value: 900, format: 'usd' });
  });
  it('toplamlar: satış sayısı satış bazında (iki kalem = 1 satış), adet ve tutar kalem bazında; satışçı/model kırılımı', () => {
    const totals = deviceTotals([
      line(), line({ line_no: 2, product_code: 'S210', quantity: 5, unit_price: 80, total_price: 400 }),
      line({ sale_id: 's2', source: 'direct', owner_name: 'Cem Koç', product_code: 'A80', quantity: 2, unit_price: 100, total_price: 200 }),
      line({ sale_id: 's3', line_no: null, product_code: null, quantity: null, total_price: null, sale_device_count: 1, sale_amount: 50 }),
    ]);
    expect(totals.sales).toBe(3);
    expect(totals.devices).toBe(18);
    expect(totals.amount).toBe(1850);
    expect(totals.withoutItems).toBe(1);
    expect(totals.byModel.find((r) => r.model === 'A80')).toEqual({ model: 'A80', devices: 12, amount: 1400 });
    expect(totals.byOwner[0]).toMatchObject({ owner: 'Furkan Kızılkurt', sales: 2 });
  });
  it('sayfalar: Kalemler başlık + satırlar + TOPLAM; boş dönemde "kayıt yok" satırı, uydurma sayı yok', () => {
    const sheets = deviceSheets([line()], meta);
    expect(sheets.map((s) => s.name)).toEqual(['Kalemler', 'Özet']);
    expect(sheets[0].rows[0]).toEqual(['Tarih', 'Firma', 'Satışçı', 'Kanal', 'Satış/Kiralama', 'Model', 'Ürün', 'Adet', 'Birim Fiyat', 'Toplam', 'Aylık Kira', 'Kira Başlangıç', 'Kira Bitiş']);
    const last = sheets[0].rows.at(-1)!;
    expect(last[0]).toBe('TOPLAM');
    expect(last[7]).toBe(10);
    expect(last[9]).toEqual({ value: 1200, format: 'usd' });
    const empty = deviceSheets([], meta);
    expect(empty[0].rows).toHaveLength(2);
    expect(String(empty[0].rows[1][0])).toContain('kayıt yok');
    expect(empty[1].rows.find((r) => r[0] === 'Dönem')?.[1]).toBe('Eylül 2026');
  });
});

describe('Hizmet Fatura Raporu — TL ile USD toplanmaz', () => {
  const inv = (over: Partial<ServiceInvoiceLine> = {}): ServiceInvoiceLine => ({
    invoice_id: 'i1', period_month: '2026-09-01', invoice_date: '2026-09-30', invoice_no: 'PSX1', musteri: 'Suwen',
    owner_name: 'Furkan Kızılkurt', currency: 'TRY', note: null, line_no: 1, service_label: 'KasaPOS Entegrasyonu + TMS',
    quantity: 134, unit_price: 347.96, total_price: 46626.64, invoice_amount: 46626.64, ...over,
  });
  // 22.09 (Sinan): Dönem ve Not kolonları KALDIRILDI; tutar para biçimli (satırın KENDİ para birimiyle),
  // tarih GG.AA.YYYY. periodMonthLabel duruyor — Özet sayfasının dönem etiketinde kullanılıyor.
  it('satır: fatura tarihi · no · firma · satışçı · hizmet · adet · birim · toplam · para birimi', () => {
    expect(periodMonthLabel('2026-09-01')).toBe('Eylül 2026');
    const row = serviceLineToRowSafe(inv());
    expect(row).toHaveLength(9);
    expect(row[0]).toEqual({ value: excelDateSerial('2026-09-30'), format: 'date' });
    expect(row.slice(1, 6)).toEqual(['PSX1', 'Suwen', 'Furkan Kızılkurt', 'KasaPOS Entegrasyonu + TMS', 134]);
    expect(row[6]).toEqual({ value: 347.96, format: 'try' });
    expect(row[7]).toEqual({ value: 46626.64, format: 'try' });
    expect(row[8]).toBe('TRY');
  });
  it('kaldırılan kolonlar yok: Dönem ve Not; fatura tarihi boşsa hücre boş kalır (uydurulmaz)', () => {
    const headers = serviceSheets([inv()], meta)[0].rows[0];
    expect(headers).toEqual(['Fatura Tarihi', 'Fatura No', 'Firma', 'Satışçı', 'Hizmet', 'Adet', 'Birim Fiyat', 'Toplam', 'Para Birimi']);
    const row = serviceLineToRowSafe(inv({ invoice_date: null, note: 'Nebim aktarımı' }));
    expect(row[0]).toBe('');
    expect(row.map((cell) => (typeof cell === 'string' ? cell : '')).join('|')).not.toContain('Nebim');
  });
  it('USD faturada $ biçimi, TL faturada ₺ biçimi; para birimi başına ayrı toplam, USD önce', () => {
    const lines = [inv(), inv({ invoice_id: 'i2', currency: 'USD', total_price: 500, invoice_amount: 500, quantity: 10, unit_price: 50 })];
    const totals = serviceTotals(lines);
    expect(totals.invoices).toBe(2);
    expect(totals.byCurrency.map((r) => [r.currency, r.amount])).toEqual([['USD', 500], ['TRY', 46626.64]]);
    const rows = serviceSheets(lines, meta)[0].rows;
    expect(rows.at(-2)![0]).toBe('TOPLAM USD');
    expect(rows.at(-2)![7]).toEqual({ value: 500, format: 'usd' });
    expect(rows.at(-1)![0]).toBe('TOPLAM TRY');
    expect(rows.at(-1)![7]).toEqual({ value: 46626.64, format: 'try' });
  });
});

describe('dosya adı ve satışçı seçenekleri', () => {
  it('dosya adı ASCII ve boşluksuz; satışçı yoksa tum-saticilar', () => {
    expect(exportFileName('cihaz', '2026-09', 'Cem Koç')).toBe('Cihaz-Satis-Raporu_2026-09_Cem-Koc.xlsx');
    expect(exportFileName('hizmet', '2026', '')).toBe('Hizmet-Fatura-Raporu_2026_tum-saticilar.xlsx');
  });
  it('satış ekibi + veride görülen ekstra ad; tekrar yok (büyük/küçük harf duyarsız)', () => {
    expect(ownerChoices(['Cem Koç', 'Ömer Canatar'], ['cem koç', 'Havuz Account', ' '])).toEqual(['Cem Koç', 'Ömer Canatar', 'Havuz Account']);
  });
});

describe('Excel paketi (simple-workbook) — gerçek dosya üretilir ve geri açılır (kural 7)', () => {
  it('sayfa adları, başlık satırı ve sayı hücreleri pakette', async () => {
    const bytes = await buildWorkbookBytes(deviceSheets([line()], meta), { title: 'Test', createdAt: new Date('2026-09-21T10:00:00Z') });
    const zip = await JSZip.loadAsync(bytes);
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toContain('name="Kalemler"');
    expect(workbook).toContain('name="Özet"');
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('<t>Birim Fiyat</t>');
    expect(sheet).toContain('<c r="H2" s="0"><v>10</v></c>');          // adet: düz sayı
    expect(sheet).toContain(`<c r="A2" s="4"><v>${excelDateSerial('2026-09-03')}</v></c>`); // tarih biçimi
    expect(sheet).toContain('<c r="I2" s="2"><v>120</v></c>');          // birim fiyat: $ biçimi
    expect(sheet).toContain('<autoFilter ref="A1:M3"/>');
    // Para ve tarih SAYI kalır (Excel'de toplanabilir); "$" ve nokta ayraç biçimden gelir.
    const styles = await zip.file('xl/styles.xml')!.async('string');
    expect(styles).toContain('numFmtId="164" formatCode="&quot;$&quot;#,##0.00"');
    expect(styles).toContain('numFmtId="166" formatCode="DD.MM.YYYY"');
    expect(styles).toContain('<cellXfs count="5">');
    const core = await zip.file('docProps/core.xml')!.async('string');
    expect(core).toContain('<dc:title>Test</dc:title>');
  });
  it('boş sayfa listesi hata verir (paket kurulmadan, eşzamanlı)', () => {
    expect(() => buildWorkbookBytes([])).toThrow('en az bir sayfa');
  });
});

// serviceLineToRow bu dosyada ad çakışmasız kullanılsın diye sarmalandı.
import { serviceLineToRow } from './sales-export-shared';
function serviceLineToRowSafe(l: ServiceInvoiceLine) { return serviceLineToRow(l); }
