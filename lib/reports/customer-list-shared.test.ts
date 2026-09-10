import { describe, expect, it } from 'vitest';
import {
  cellItems,
  cleanFirmName,
  countsByCategory,
  countsByOwner,
  filterItems,
  findOwner,
  firmKey,
  isCustomerListCategory,
  nextSira,
  normalizeName,
  orderOwners,
  siraBefore,
  type CustomerListItem,
} from './customer-list-shared';

function item(partial: Partial<CustomerListItem> & Pick<CustomerListItem, 'id' | 'owner' | 'category' | 'firma'>): CustomerListItem {
  return { ownerUserId: null, sira: 10, note: null, updatedAt: null, updatedBy: null, ...partial };
}

const ITEMS: CustomerListItem[] = [
  item({ id: 'a1', owner: 'Furkan Kızılkurt', category: 'H', firma: 'ADİL IŞIK', sira: 10 }),
  item({ id: 'a2', owner: 'Furkan Kızılkurt', category: 'H', firma: 'AKER', sira: 20 }),
  item({ id: 'a3', owner: 'Furkan Kızılkurt', category: 'F', firma: 'ALTINYILDIZ', sira: 10 }),
  item({ id: 'b1', owner: 'Ömer Canatar', category: 'K', firma: 'omnipos', sira: 10 }),
  item({ id: 'b2', owner: 'ÖMER CANATAR', category: 'K', firma: 'posback', sira: 20 }),
  item({ id: 'c1', owner: 'Erdi Toraman', category: 'H', firma: 'ACIBADEM', sira: 10 }),
  item({ id: 'x1', owner: 'Eski Çalışan', category: 'L', firma: 'FİRMA X', sira: 10 }),
];

describe('customer-list-shared · isimler ve anahtarlar', () => {
  it('firma adını temizler ama büyük/küçük harfe dokunmaz', () => {
    expect(cleanFirmName('  Bella   Maison ')).toBe('Bella Maison');
    expect(firmKey('  MİGROS ')).toBe('migros');
    expect(firmKey('AKINSOFT')).toBe('akınsoft');
    expect(firmKey('Şok Marketler')).toBe(firmKey('ŞOK MARKETLER'));
  });

  it('kişi adı anahtarı Türkçe duyarlı ve boşluk toleranslı', () => {
    expect(normalizeName('ÖMER  CANATAR')).toBe(normalizeName('Ömer Canatar'));
    expect(normalizeName('Furkan Kızılkurt')).not.toBe(normalizeName('Furkan Yılmaz'));
  });

  it('kategori doğrulaması yalnız H/F/L/K kabul eder', () => {
    expect(isCustomerListCategory('H')).toBe(true);
    expect(isCustomerListCategory('K')).toBe(true);
    expect(isCustomerListCategory('X')).toBe(false);
    expect(isCustomerListCategory(null)).toBe(false);
  });
});

describe('customer-list-shared · kolonlar', () => {
  it('kolonlar: satış ekibi + listede geçenler + Havuz Account + Yemek Kartları; yönetici hesabı kolon açmaz (Sinan, 10.09)', () => {
    const users = [
      { id: 'u-seda', name: 'Seda Kesikoğlu' },
      { id: 'u-cem', name: 'Cem Koç' },
      { id: 'u-furkan', name: 'Furkan Kızılkurt' },
      { id: 'u-gm', name: 'Görkem İlbay' }, // ikincil rolü account_manager olan genel müdür
    ];
    const owners = orderOwners(users, ITEMS);
    expect(owners.map((o) => o.name)).toEqual(['Cem Koç', 'Ömer Canatar', 'Furkan Kızılkurt', 'Erdi Toraman', 'Seda Kesikoğlu', 'Havuz Account', 'Yemek Kartları', 'Eski Çalışan']);
    expect(findOwner(owners, 'cem koç')?.id).toBe('u-cem');
    expect(findOwner(owners, 'Erdi Toraman')?.id).toBeNull(); // yalnız listeden geliyor
    expect(findOwner(owners, 'Havuz Account')?.id).toBeNull(); // sabit kolon, kullanıcı değil
    expect(findOwner(owners, 'Yemek Kartları')?.id).toBeNull();
    expect(findOwner(owners, 'Görkem İlbay')).toBeNull(); // yönetici hesabı hiç görünmez
  });

  it('kolon dışı kişi listeye firma alınca kolon olur', () => {
    const users = [{ id: 'u-gm', name: 'Görkem İlbay' }];
    const withFirm = [...ITEMS, item({ id: 'g1', owner: 'Görkem İlbay', ownerUserId: 'u-gm', category: 'H', firma: 'GM FİRMA' })];
    const owners = orderOwners(users, withFirm);
    expect(findOwner(owners, 'Görkem İlbay')?.id).toBe('u-gm');
  });

  it('aynı kişinin farklı yazımlarını tek kolonda toplar', () => {
    const owners = orderOwners([{ id: 'u-omer', name: 'Ömer Canatar' }], ITEMS);
    expect(owners.filter((o) => normalizeName(o.name) === normalizeName('Ömer Canatar'))).toHaveLength(1);
    expect(cellItems(ITEMS, 'Ömer Canatar', 'K').map((i) => i.firma)).toEqual(['omnipos', 'posback']);
  });

  it('hücre sıraya göre dizilir', () => {
    const rows = cellItems([...ITEMS].reverse(), 'Furkan Kızılkurt', 'H');
    expect(rows.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(nextSira(ITEMS, 'Furkan Kızılkurt', 'H')).toBe(30);
    expect(nextSira(ITEMS, 'Furkan Kızılkurt', 'K')).toBe(10);
  });
});

describe('customer-list-shared · sayaçlar', () => {
  it('kişi başına H/F/L/K sayar (Canlı Ekran donut kaynağı)', () => {
    const counts = countsByOwner(ITEMS);
    expect(counts.get(normalizeName('Furkan Kızılkurt'))).toEqual({ H: 2, F: 1, L: 0, K: 0, total: 3 });
    expect(counts.get(normalizeName('Ömer Canatar'))).toEqual({ H: 0, F: 0, L: 0, K: 2, total: 2 });
    expect(counts.get(normalizeName('Seda Kesikoğlu'))).toBeUndefined();
  });

  it('kategori toplamları', () => {
    expect(countsByCategory(ITEMS)).toEqual({ H: 3, F: 1, L: 1, K: 2, total: 7 });
  });

  it('arama Türkçe duyarsız, boş sorgu her şeyi döner', () => {
    expect(filterItems(ITEMS, '')).toHaveLength(7);
    expect(filterItems(ITEMS, 'acıbadem').map((i) => i.id)).toEqual(['c1']);
    expect(filterItems(ITEMS, 'POS').map((i) => i.id)).toEqual(['b1', 'b2']);
  });
});

describe('customer-list-shared · sürükle-bırak sırası', () => {
  const cell = cellItems(ITEMS, 'Furkan Kızılkurt', 'H'); // 10, 20

  it('hedef verilmezse sona', () => {
    expect(siraBefore(cell, null)).toEqual({ sira: 30, renumber: false });
    expect(siraBefore([], null)).toEqual({ sira: 10, renumber: false });
  });

  it('bir kaydın önüne araya sığar', () => {
    expect(siraBefore(cell, 'a2')).toEqual({ sira: 15, renumber: false });
    expect(siraBefore(cell, 'a1')).toEqual({ sira: 5, renumber: false });
  });

  it('araya yer yoksa yeniden numaralama ister', () => {
    const tight = [item({ id: 't1', owner: 'X', category: 'H', firma: 'A', sira: 1 }), item({ id: 't2', owner: 'X', category: 'H', firma: 'B', sira: 2 })];
    expect(siraBefore(tight, 't2')).toEqual({ sira: 2, renumber: true });
  });

  it('bilinmeyen hedef → sona', () => {
    expect(siraBefore(cell, 'yok')).toEqual({ sira: 30, renumber: false });
  });
});
