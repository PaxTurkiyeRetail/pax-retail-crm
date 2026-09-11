/**
 * Hedefler (v2, Çağdaş Bey 10.09.2026) — paylaşımlı tipler ve saf yardımcılar.
 *
 * Kişi bazlı hedefler Admin / Super Admin tarafından Hedefler ekranından girilir
 * (/admin/targets); Canlı Ekran kişi slaytı içinde bulunulan çeyreğin ve yılın
 * donut'larını buradan okur. Veri: allowed_users.weekly_target_total_activities
 * (haftalık aktivite) + crm_target_values (yıl / çeyrek; migration 026).
 *
 * Bu dosya `server-only` içermez: istemci bileşeni, Canlı Ekran ve vitest buradan okur.
 */
import { OWNER_ORDER, normalizeName } from './live-board-shared';

/**
 * Hedef girilebilen kişi mi? **Yalnız satış ekibi** — Canlı Ekran OWNER_ORDER'ında adı geçen
 * kişiler (Sinan, 10.09: "Görkem İlbay olmasın direkt", ikinci kez). Rol listesine güvenilmez:
 * migration 016 ikincil rolü `account_manager` olan yönetici hesaplarına da haftalık 20 yazdığı
 * için "hedefi olan herkes" ölçütü genel müdürü geri getiriyordu. Yeni satışçı gelince
 * OWNER_ORDER'a eklenir (Müşteri Listesi kolon kuralıyla aynı tek kaynak).
 * `İş Ortakları`, `Havuz Account`, `Yemek Kartları` kullanıcı değildir; sorguya zaten düşmezler.
 */
export function isTargetOwnerName(name: string): boolean {
  const key = normalizeName(name);
  return OWNER_ORDER.some((known) => normalizeName(known) === key);
}

export type TargetCode =
  | 'sales_revenue'
  | 'device_count'
  | 'integration_count'
  | 'visit_count'
  | 'hunter_to_farmer'
  | 'lead_to_hunter'
  | 'quotes_won_count'
  | 'covered_customers'
  | 'contacts_per_customer';

export type TargetPeriod = 'year' | 'quarter';

export type TargetDefinition = {
  code: TargetCode;
  label: string;
  /** Kısa açıklama (Hedefler ekranı). */
  hint: string;
  unit: 'money' | 'count';
  /** Girilebilen dönemler: yıl her zaman; çeyrek bütçe, ziyaret ve entegrasyon (11.09 toplantısı). */
  periods: readonly TargetPeriod[];
};

export const TARGET_DEFINITIONS: readonly TargetDefinition[] = [
  { code: 'sales_revenue', label: 'Bütçe (ciro, USD)', hint: 'Satış kaydına dönen tekliflerin tutarı (crm_sales)', unit: 'money', periods: ['year', 'quarter'] },
  { code: 'visit_count', label: 'Ziyaret', hint: 'Fiziki + online satış görüşmesi sayısı', unit: 'count', periods: ['year', 'quarter'] },
  { code: 'integration_count', label: 'Entegrasyon', hint: 'KasaPOS entegrasyonu tamamlanan firma (gerçekleşen sayaç fatura verisi bağlanınca açılır)', unit: 'count', periods: ['year', 'quarter'] },
  { code: 'device_count', label: 'Cihaz', hint: 'Satışa dönen cihaz adedi', unit: 'count', periods: ['year'] },
  { code: 'hunter_to_farmer', label: 'Hunter → Farmer', hint: 'Müşteri Listesi’nde H’den F’ye taşınan firma', unit: 'count', periods: ['year'] },
  { code: 'lead_to_hunter', label: 'Lead → Hunter', hint: 'Müşteri Listesi’nde L’den H’ye taşınan firma', unit: 'count', periods: ['year'] },
  { code: 'quotes_won_count', label: 'Kazanılan teklif', hint: 'Yıl içinde kazanılan (closed · won) teklif adedi', unit: 'count', periods: ['year'] },
  { code: 'covered_customers', label: 'Kapsanan firma', hint: 'Yıl içinde en az bir aktivite girilen tekil firma', unit: 'count', periods: ['year'] },
  { code: 'contacts_per_customer', label: 'Ortalama temas / firma', hint: 'Yıl içi aktivite / kapsanan firma', unit: 'count', periods: ['year'] },
];

export const TARGET_CODES: readonly TargetCode[] = TARGET_DEFINITIONS.map((d) => d.code);
export const QUARTERLY_TARGET_CODES: readonly TargetCode[] = TARGET_DEFINITIONS.filter((d) => d.periods.includes('quarter')).map((d) => d.code);

export function isTargetCode(value: unknown): value is TargetCode {
  return typeof value === 'string' && (TARGET_CODES as readonly string[]).includes(value);
}

export function targetDefinition(code: TargetCode): TargetDefinition {
  return TARGET_DEFINITIONS.find((d) => d.code === code) ?? TARGET_DEFINITIONS[0];
}

/* --- Çeyrek yardımcıları --------------------------------------------------- */

export type QuarterIndex = 1 | 2 | 3 | 4;
export type Quarter = { year: number; index: QuarterIndex; label: string; months: string; start: string; end: string };

const QUARTER_MONTHS: Record<QuarterIndex, string> = { 1: 'Oca–Mar', 2: 'Nis–Haz', 3: 'Tem–Eyl', 4: 'Eki–Ara' };

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

/** Yılın verilen çeyreği: başlangıç/bitiş gün anahtarları (YYYY-MM-DD). */
export function quarterRange(year: number, index: QuarterIndex): Quarter {
  const startMonth = (index - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = endMonth === 3 || endMonth === 12 ? 31 : 30; // Mar 31 · Haz 30 · Eyl 30 · Ara 31
  return {
    year,
    index,
    label: `Q${index}`,
    months: QUARTER_MONTHS[index],
    start: `${year}-${pad2(startMonth)}-01`,
    end: `${year}-${pad2(endMonth)}-${endDay}`,
  };
}

/** Gün anahtarının (YYYY-MM-DD) içinde bulunduğu çeyrek. */
export function quarterOf(dayKey: string): Quarter {
  const year = Number(dayKey.slice(0, 4));
  const month = Number(dayKey.slice(5, 7));
  const index = (Math.min(4, Math.max(1, Math.ceil(month / 3))) as QuarterIndex);
  return quarterRange(year, index);
}

export const QUARTER_INDEXES: readonly QuarterIndex[] = [1, 2, 3, 4];

/** Çeyreğin geçen süre oranı (0–100); hız yorumunda kullanılır. */
export function quarterElapsedPct(dayKey: string): number {
  const quarter = quarterOf(dayKey);
  const start = Date.UTC(Number(quarter.start.slice(0, 4)), Number(quarter.start.slice(5, 7)) - 1, Number(quarter.start.slice(8, 10)));
  const end = Date.UTC(Number(quarter.end.slice(0, 4)), Number(quarter.end.slice(5, 7)) - 1, Number(quarter.end.slice(8, 10)));
  const today = Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)));
  const total = (end - start) / 86_400_000 + 1;
  const elapsed = (today - start) / 86_400_000 + 1;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

/* --- Hedef / gerçekleşme çifti ------------------------------------------- */

/** Canlı Ekran donut'u: gerçekleşen, hedef (yoksa null) ve yüzde (hedef yoksa null). */
export type GoalPair = { actual: number; target: number | null; pct: number | null };

export function goalPair(actual: number, target: number | null | undefined): GoalPair {
  const safeTarget = target != null && target > 0 ? target : null;
  return {
    actual,
    target: safeTarget,
    pct: safeTarget == null ? null : Math.round((actual / safeTarget) * 100),
  };
}

/* --- Hedefler ekranı yükü ------------------------------------------------- */

export type QuarterValues = [number | null, number | null, number | null, number | null];

export type TargetsAdminUser = {
  id: string;
  name: string;
  email: string;
  /** allowed_users.weekly_target_total_activities (0 = hedef yok). */
  weeklyTotal: number;
  yearly: Partial<Record<TargetCode, number | null>>;
  quarterly: Partial<Record<TargetCode, QuarterValues>>;
};

export type TargetsAdminPayload = {
  generatedAt: string;
  year: number;
  quarters: Quarter[];
  users: TargetsAdminUser[];
};

/** Ekrandan gelen ham değer: sayı, metin ("1.500.000"), boş. normalizeTargetValue ile sayıya iner. */
export type TargetInputValue = number | string | null | undefined;

export type SaveTargetsInput = {
  year: number;
  userId: string;
  weeklyTotal?: TargetInputValue;
  yearly?: Partial<Record<TargetCode, TargetInputValue>>;
  quarterly?: Partial<Record<TargetCode, TargetInputValue[]>>;
};

/** Girdi normalizasyonu: boş / geçersiz / ≤ 0 → null (kayıt silinir); para tam sayıya yuvarlanır. */
export function normalizeTargetValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  let parsed: number;
  if (typeof value === 'number') parsed = value;
  else {
    const raw = String(value).replace(/\s/g, '');
    // "1.500.000,50" (TR) → nokta binlik, virgül ondalık; "1.500.000" → binlik; "1500.5" (EN) → nokta ondalık.
    if (raw.includes(',')) parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) parsed = Number(raw.replace(/\./g, ''));
    else parsed = Number(raw);
  }
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function targetYearOf(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 2024 || parsed > 2100) return fallback;
  return Math.floor(parsed);
}

/**
 * Yıllık hedefin çeyreklere bölünmesi (Sinan, 10.09): eşit böl, bölünmeyen kalanı SON çeyreklere ekle.
 * 100 → 25·25·25·25 · 101 → 25·25·25·26 · 102 → 25·25·26·26. Ekran bu kuralı yazarken uygular;
 * burada saf hâli testlerden ve ileride sunucu tarafından kullanılabilsin diye durur.
 */
export function splitYearlyToQuarters(total: number | null): QuarterValues {
  if (total == null || total <= 0) return [null, null, null, null];
  const base = Math.floor(total / 4);
  const extra = total - base * 4;
  return [0, 1, 2, 3].map((index) => base + (index >= 4 - extra ? 1 : 0)) as QuarterValues;
}
