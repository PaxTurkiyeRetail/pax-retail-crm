import 'server-only';
import { db } from '@/lib/db';
import {
  NEAR_TERM_MONTH_WINDOW,
  SELLER_FOLLOWUP_PAGE_SIZE,
  formatModelAdet,
  nearTermBoundary,
  nearTermRangeLabel,
  type SellerFollowupModel,
} from '@/lib/reports/seller-followup-shared';

// Sabitler ve tarih yardımcıları seller-followup-shared.ts'te durur (testler
// 'server-only' yüzünden bu dosyayı yükleyemiyor); buradan yeniden yayınlanır.
export {
  NEAR_TERM_MONTH_WINDOW,
  SELLER_FOLLOWUP_PAGE_SIZE,
  nearTermBoundary,
  nearTermRangeLabel,
};
export type { SellerFollowupModel };

// Satışçı Takip Raporu veri katmanı.
//
// Kaynak: v_crm_forecast_blocker_impact (Engel & Etki ekranının beslendiği view).
// Rapora yalnızca AÇIK engeller girer; çözülmüş (resolved), engeli olmayan
// (no_blocker) ve henüz cevaplanmamış (pending) kayıtlar listeye alınmaz.
//
// Kolon eşlemesi (görseldeki Takip Listesi):
//   Müşteri       → musteri
//   Konu Kimde    → resolution_owner_name (+ resolution_owner_type etiketi)
//   Model / Adet  → forecast_options (jsonb: ürün kodu + adet)
//   Takip Konusu  → blocker_description (+ notes ek açıklaması)
//   Çözüm Tarihi  → resolution_due_date (planlanan çözüm tarihi)

const ACTIVE_BLOCKER_STATUSES = ['open', 'in_progress', 'overdue'] as const;

const RESOLUTION_OWNER_TYPE_LABELS: Record<string, string> = {
  internal: 'İç ekip',
  customer: 'Müşteri',
  bank: 'Banka',
  partner: 'İş ortağı',
  other: 'Diğer',
};

export type SellerFollowupRow = {
  customerId: string;
  musteri: string;
  sektor: string | null;
  sorumlu: string | null;
  /** Görseldeki "Konu Kimde" kolonu. */
  konuKimde: string;
  konuKimdeTipi: string | null;
  models: SellerFollowupModel[];
  /** "A80: 121, S210: 121" biçiminde hazır metin. */
  modelAdetLabel: string;
  totalQuantity: number;
  takipKonusu: string;
  notes: string | null;
  cozumTarihi: string | null;
  effectiveStatus: string;
  /** Çözüm tarihi geçmiş mi (görselde kırmızı vurgu). */
  overdue: boolean;
  /** Çözüm tarihi bu ay dahil önümüzdeki 3 ay içinde mi. */
  nearTerm: boolean;
};

export type SellerFollowupPayload = {
  filters: { owner: string; from: string; to: string };
  summary: {
    /** Açık takip: durumu açık engel olan kayıt sayısı. */
    openFollowupCount: number;
    /** Toplam adet: takip listesindeki hesapların forecast adetleri toplamı. */
    totalQuantity: number;
    /** Yakın vadeli takip: çözüm tarihi bu ay dahil 3 ay içinde olanların adet toplamı. */
    nearTermQuantity: number;
    /** Yakın vadeli kayıtların firma adları (görselde alt açıklama). */
    nearTermCustomers: string[];
    /** Yakın vade penceresinin ay etiketi (ör. "Eylül–Kasım"). */
    nearTermLabel: string;
  };
  rows: SellerFollowupRow[];
  /** 10'arlı sayfalar; sunum/PDF çıktısında her sayfa ayrı slayt olur. */
  pages: SellerFollowupRow[][];
  ownerOptions: string[];
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseModels(forecastOptions: unknown): SellerFollowupModel[] {
  const raw = Array.isArray(forecastOptions) ? forecastOptions : [];
  const byCode = new Map<string, SellerFollowupModel>();
  for (const item of raw) {
    const productCode = String((item as any)?.product_code ?? '').trim()
      || String((item as any)?.product_name ?? '').trim();
    if (!productCode) continue;
    const quantity = toNumber((item as any)?.quantity);
    const existing = byCode.get(productCode);
    if (existing) {
      existing.quantity += quantity;
      continue;
    }
    byCode.set(productCode, {
      productCode,
      productName: String((item as any)?.product_name ?? '').trim() || productCode,
      quantity,
    });
  }
  return Array.from(byCode.values()).sort((a, b) => b.quantity - a.quantity || a.productCode.localeCompare(b.productCode, 'tr'));
}

export async function buildSellerFollowupReport(options?: {
  owner?: string;
  today?: Date;
}): Promise<SellerFollowupPayload> {
  const owner = String(options?.owner ?? '').trim();
  const today = options?.today ?? new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nearTermEnd = nearTermBoundary(today);

  const result = await db.query(
    `
      select
        customer_id::text as customer_id,
        musteri,
        sektor,
        sorumlu,
        resolution_owner_type,
        resolution_owner_name,
        resolution_due_date,
        blocker_description,
        notes,
        effective_status,
        total_forecast_quantity,
        forecast_options
      from public.v_crm_forecast_blocker_impact
      where effective_status = any($1::text[])
      order by resolution_due_date asc nulls last, musteri asc
    `,
    [ACTIVE_BLOCKER_STATUSES],
  );

  const allRows = result.rows as any[];
  const ownerOptions = Array.from(
    new Set(allRows.map((row) => String(row.sorumlu ?? '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'tr'));

  const rows: SellerFollowupRow[] = allRows
    .filter((row) => !owner || String(row.sorumlu ?? '').trim() === owner)
    .map((row) => {
      const models = parseModels(row.forecast_options);
      const dueDateText = row.resolution_due_date
        ? new Date(row.resolution_due_date).toISOString().slice(0, 10)
        : null;
      const dueDate = dueDateText ? new Date(`${dueDateText}T00:00:00`) : null;
      const ownerType = cleanText(row.resolution_owner_type);
      // Adet tercihen forecast kalemlerinden hesaplanır; view'in özeti yedek kalır.
      const modelTotal = models.reduce((total, model) => total + model.quantity, 0);
      const totalQuantity = modelTotal || toNumber(row.total_forecast_quantity);

      return {
        customerId: String(row.customer_id),
        musteri: String(row.musteri ?? '').trim(),
        sektor: cleanText(row.sektor),
        sorumlu: cleanText(row.sorumlu),
        konuKimde: cleanText(row.resolution_owner_name)
          ?? (ownerType ? RESOLUTION_OWNER_TYPE_LABELS[ownerType] ?? ownerType : '—'),
        konuKimdeTipi: ownerType ? RESOLUTION_OWNER_TYPE_LABELS[ownerType] ?? ownerType : null,
        models,
        modelAdetLabel: formatModelAdet(models),
        totalQuantity,
        takipKonusu: cleanText(row.blocker_description) ?? '—',
        notes: cleanText(row.notes),
        cozumTarihi: dueDateText,
        effectiveStatus: String(row.effective_status ?? ''),
        overdue: Boolean(dueDate && dueDate < startOfToday),
        nearTerm: Boolean(dueDate && dueDate <= nearTermEnd),
      };
    });

  const nearTermRows = rows.filter((row) => row.nearTerm);
  const pages: SellerFollowupRow[][] = [];
  for (let index = 0; index < rows.length; index += SELLER_FOLLOWUP_PAGE_SIZE) {
    pages.push(rows.slice(index, index + SELLER_FOLLOWUP_PAGE_SIZE));
  }

  return {
    filters: {
      owner,
      from: startOfToday.toISOString().slice(0, 10),
      to: nearTermEnd.toISOString().slice(0, 10),
    },
    summary: {
      openFollowupCount: rows.length,
      totalQuantity: rows.reduce((total, row) => total + row.totalQuantity, 0),
      nearTermQuantity: nearTermRows.reduce((total, row) => total + row.totalQuantity, 0),
      nearTermCustomers: Array.from(new Set(nearTermRows.map((row) => row.musteri))).filter(Boolean),
      nearTermLabel: nearTermRangeLabel(today),
    },
    rows,
    pages: pages.length ? pages : [[]],
    ownerOptions,
  };
}
