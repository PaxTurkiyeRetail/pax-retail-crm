/**
 * Müşteri Listesi (H/F/L/K) — paylaşımlı tipler ve saf yardımcılar.
 *
 * Çağdaş Bey'in kişi bazlı firma dağılım Excel'i ("CRM Müşteriler Dosyası") CRM'e
 * taşındı (Sinan, 09.09.2026). Dört ayrı tablo: H = Hunter · F = Farmer · L = Lead ·
 * K = Kasa Firması; kolonlar = satış ekibi (Canlı Ekran OWNER_ORDER sırası). Herkes
 * görür, yalnız `customer.assignment_list.manage` yetkisi olan (admin, super_admin)
 * düzenler. Veri: `crm_musteri_listesi` (migration 025).
 *
 * Bu dosya `server-only` içermez: hem istemci bileşeni hem Canlı Ekran hem de
 * vitest buradan okur. DB erişimi `customer-list.ts`'te.
 */
import { OWNER_ORDER, normalizeName, ownerOrderCompare } from './live-board-shared';

export type CustomerListCategory = 'H' | 'F' | 'L' | 'K';

export const CUSTOMER_LIST_CATEGORIES: ReadonlyArray<{
  key: CustomerListCategory;
  label: string;
  /** Kısa açıklama (tablo başlığının altında). */
  hint: string;
}> = [
  { key: 'H', label: 'Hunter', hint: 'Yeni kazanım hedefi — henüz müşteri olmayan hedef firmalar' },
  { key: 'F', label: 'Farmer', hint: 'Mevcut müşteri — büyütme ve elde tutma' },
  { key: 'L', label: 'Lead', hint: 'İlk temas / aday firma' },
  { key: 'K', label: 'Kasa Firması', hint: 'Kasa / yazılım iş ortağı firmaları' },
];

export const CUSTOMER_LIST_CATEGORY_KEYS: readonly CustomerListCategory[] = CUSTOMER_LIST_CATEGORIES.map((c) => c.key);

export function isCustomerListCategory(value: unknown): value is CustomerListCategory {
  return typeof value === 'string' && (CUSTOMER_LIST_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function categoryLabel(key: CustomerListCategory) {
  return CUSTOMER_LIST_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Tek satır: bir kişinin bir kategorisindeki bir firma. */
export type CustomerListItem = {
  id: string;
  category: CustomerListCategory;
  /** Görünen ad (allowed_users.full_name yazımı). */
  owner: string;
  ownerUserId: string | null;
  firma: string;
  sira: number;
  note: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Kolon adayı: aktif account_manager kullanıcıları ∪ listede geçen adlar. */
export type CustomerListOwner = { id: string | null; name: string };

export type CustomerListPayload = {
  generatedAt: string;
  items: CustomerListItem[];
  owners: CustomerListOwner[];
  /** İstek sahibinin düzenleme yetkisi (customer.assignment_list.manage). API yine kontrol eder. */
  canManage: boolean;
};

export type CustomerListCounts = { H: number; F: number; L: number; K: number; total: number };

export function emptyCounts(): CustomerListCounts {
  return { H: 0, F: 0, L: 0, K: 0, total: 0 };
}

/** Firma adı normalizasyonu: baş/son boşluk, çoklu boşluk. Büyük/küçük harf korunur. */
export function cleanFirmName(value: string) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Mükerrer kontrolü için anahtar (aynı kişi + kategori altında). */
export function firmKey(value: string) {
  return cleanFirmName(value).toLocaleLowerCase('tr');
}

export const FIRM_NAME_MAX = 160;

/**
 * Kolon sırası: OWNER_ORDER'daki adlar önce (o sırayla), kalanlar alfabetik.
 * Listede geçen ama kullanıcı olmayan adlar (ör. eski çalışan) kolon olarak kalır —
 * firmaları "kaybolmasın".
 */
export function orderOwners(owners: CustomerListOwner[], items: CustomerListItem[]): CustomerListOwner[] {
  const byKey = new Map<string, CustomerListOwner>();
  for (const owner of owners) {
    const key = normalizeName(owner.name);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, { id: owner.id ?? null, name: owner.name });
    else if (!existing.id && owner.id) byKey.set(key, { id: owner.id, name: existing.name });
  }
  for (const item of items) {
    const key = normalizeName(item.owner);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, { id: item.ownerUserId, name: item.owner });
  }
  return Array.from(byKey.values()).sort((a, b) => ownerOrderCompare(a.name, b.name));
}

/** Kişi × kategori hücresi: sıraya (sira, sonra ada) göre dizili firmalar. */
export type CustomerListCell = { owner: CustomerListOwner; category: CustomerListCategory; items: CustomerListItem[] };

export function cellItems(items: CustomerListItem[], ownerName: string, category: CustomerListCategory): CustomerListItem[] {
  const key = normalizeName(ownerName);
  return items
    .filter((item) => item.category === category && normalizeName(item.owner) === key)
    .sort((a, b) => a.sira - b.sira || a.firma.localeCompare(b.firma, 'tr'));
}

/** Kişi başına H/F/L/K sayıları (Canlı Ekran donut'u ve kolon başlıkları bunu okur). */
export function countsByOwner(items: CustomerListItem[]): Map<string, CustomerListCounts> {
  const result = new Map<string, CustomerListCounts>();
  for (const item of items) {
    const key = normalizeName(item.owner);
    const counts = result.get(key) ?? emptyCounts();
    counts[item.category] += 1;
    counts.total += 1;
    result.set(key, counts);
  }
  return result;
}

/** Kategori başına toplam (KPI şeridi). */
export function countsByCategory(items: CustomerListItem[]): CustomerListCounts {
  const counts = emptyCounts();
  for (const item of items) {
    counts[item.category] += 1;
    counts.total += 1;
  }
  return counts;
}

/**
 * Arama filtresi: firma adında (Türkçe duyarsız) geçenler. Boş sorgu → hepsi.
 * Not: filtre yalnız görünümü daraltır; sayaçlar filtresiz kalır (yanıltmasın).
 */
export function filterItems(items: CustomerListItem[], query: string): CustomerListItem[] {
  const q = normalizeName(query);
  if (!q) return items;
  return items.filter((item) => normalizeName(item.firma).includes(q) || normalizeName(item.note ?? '').includes(q));
}

/** Yeni firmanın hücre sonuna eklenmesi için sıra değeri (10'ar adım). */
export function nextSira(items: CustomerListItem[], ownerName: string, category: CustomerListCategory) {
  const cell = cellItems(items, ownerName, category);
  return cell.length ? Math.max(...cell.map((item) => item.sira)) + 10 : 10;
}

/**
 * Sürükle-bırak sonrası hedef hücrede sıra: `beforeId` verilirse o kaydın önüne,
 * verilmezse sona. Dönen değer tek kaydın yeni `sira`sı; komşuların arasına sığmazsa
 * (aynı değer) çağıran taraf hücreyi 10'ar adımla yeniden numaralar (`renumber`).
 */
export function siraBefore(cell: CustomerListItem[], beforeId: string | null): { sira: number; renumber: boolean } {
  if (!cell.length) return { sira: 10, renumber: false };
  if (!beforeId) return { sira: cell[cell.length - 1].sira + 10, renumber: false };
  const index = cell.findIndex((item) => item.id === beforeId);
  if (index === -1) return { sira: cell[cell.length - 1].sira + 10, renumber: false };
  const next = cell[index].sira;
  const prev = index > 0 ? cell[index - 1].sira : 0;
  if (next - prev > 1) return { sira: Math.floor((prev + next) / 2), renumber: false };
  return { sira: next, renumber: true };
}

/** Kolon adayları arasından ada göre kişi bul (kullanıcı id'siyle birlikte). */
export function findOwner(owners: CustomerListOwner[], name: string): CustomerListOwner | null {
  const key = normalizeName(name);
  return owners.find((owner) => normalizeName(owner.name) === key) ?? null;
}

export { OWNER_ORDER, normalizeName };
