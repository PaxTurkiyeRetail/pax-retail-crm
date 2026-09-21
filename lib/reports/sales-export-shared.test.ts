import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { buildWorkbookBytes } from '@/lib/xlsx/simple-workbook';
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
  it('kalem satırı: tarih · firma · satışçı · satış tipi · kanal · kalem · model · adet · birim · toplam', () => {
    const row = deviceLineToRow(line());
    expect(row.slice(0, 11)).toEqual(['2026-09-03', 'Kiğılı', 'Furkan Kızılkurt', 'Teklifli satış', 'Direkt Satış', 'Satış', 'A80', 'PAX A80', 10, 120, 1200]);
    expect(deviceLineToRow(line({ source: 'direct' }))[3]).toBe('Direkt satış');
    expect(deviceLineToRow(line({ sale_type: 'rental', rental_monthly_price: 15 }))[5]).toBe('Kiralama');
    expect(deviceLineToRow(line({ sale_type: 'rental', rental_monthly_price: 15 }))[11]).toBe(15);
  });
  it('kalemi olmayan eski satış atlanmaz: başlık adedi/tutarı iner, birim fiyat BOŞ, not düşer', () => {
    const row = deviceLineToRow(line({ line_no: null, product_code: null, quantity: null, unit_price: null, total_price: null, sale_device_count: 4, sale_amount: 900 }));
    expect(row[6]).toBe('—');
    expect(row[8]).toBe(4);
    expect(row[9]).toBe('');
    expect(row[10]).toBe(900);
    expect(String(row[15])).toContain('Kalem kaydı yok');
  });
  it('toplamlar: satış sayısı satış bazında (iki kalem = 1 satış), adet ve tutar kalem bazında; tip/satışçı/model kırılımı', () => {
    const totals = deviceTotals([
      line(), line({ line_no: 2, product_code: 'S210', quantity: 5, unit_price: 80, total_price: 400 }),
      line({ sale_id: 's2', source: 'direct', owner_name: 'Cem Koç', product_code: 'A80', quantity: 2, unit_price: 100, total_price: 200 }),
      line({ sale_id: 's3', line_no: null, product_code: null, quantity: null, total_price: null, sale_device_count: 1, sale_amount: 50 }),
    ]);
    expect(totals.sales).toBe(3);
    expect(totals.devices).toBe(18);
    expect(totals.amount).toBe(1850);
    expect(totals.withoutItems).toBe(1);
    expect(totals.bySource.map((r) => [r.source, r.sales, r.amount])).toEqual([['Teklifli satış', 2, 1650], ['Direkt satış', 1, 200]]);
    expect(totals.byModel.find((r) => r.model === 'A80')).toEqual({ model: 'A80', devices: 12, amount: 1400 });
    expect(totals.byOwner[0]).toMatchObject({ owner: 'Furkan Kızılkurt', sales: 2 });
  });
  it('sayfalar: Kalemler başlık + satırlar + TOPLAM; boş dönemde "kayıt yok" satırı, uydurma sayı yok', () => {
    const sheets = deviceSheets([line()], meta);
    expect(sheets.map((s) => s.name)).toEqual(['Kalemler', 'Özet']);
    const last = sheets[0].rows.at(-1)!;
    expect(last[0]).toBe('TOPLAM');
    expect(last[8]).toBe(10);
    expect(last[10]).toBe(1200);
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
  it('dönem etiketi ve satır', () => {
    expect(periodMonthLabel('2026-09-01')).toBe('Eylül 2026');
    const row = serviceLineToRowSafe(inv());
    expect(row.slice(0, 10)).toEqual(['Eylül 2026', '2026-09-30', 'PSX1', 'Suwen', 'Furkan Kızılkurt', 'KasaPOS Entegrasyonu + TMS', 134, 347.96, 46626.64, 'TRY']);
  });
  it('para birimi başına ayrı toplam satırı; USD önce', () => {
    const lines = [inv(), inv({ invoice_id: 'i2', currency: 'USD', total_price: 500, invoice_amount: 500, quantity: 10, unit_price: 50 })];
    const totals = serviceTotals(lines);
    expect(totals.invoices).toBe(2);
    expect(totals.byCurrency.map((r) => [r.currency, r.amount])).toEqual([['USD', 500], ['TRY', 46626.64]]);
    const rows = serviceSheets(lines, meta)[0].rows;
    expect(rows.at(-2)![0]).toBe('TOPLAM USD');
    expect(rows.at(-1)![0]).toBe('TOPLAM TRY');
    expect(rows.at(-1)![8]).toBe(46626.64);
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
    expect(sheet).toContain('<t>Birim Fiyat (USD)</t>');
    expect(sheet).toContain('<c r="I2" s="0"><v>10</v></c>');
    expect(sheet).toContain('<autoFilter ref="A1:P3"/>');
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
