import 'server-only';
import { db } from '@/lib/db';
import { tryRecordAuditEvent } from '@/lib/audit';
import { INTEGRATION_DEVICE_SERVICE_KEYS } from '@/lib/sales/service-invoices-shared';
import {
  computeKasaposEntegrasyon, round2,
  type KasaposEntegrasyonPayload, type KasaposFirmSource, type KasaposInvoiceAggregate,
} from './kasapos-entegrasyon-shared';

export * from './kasapos-entegrasyon-shared';

// KasaPOS Entegrasyon Raporu — veri (repository) + servis katmanı. Hesap: kasapos-entegrasyon-shared.
// Kaynaklar:
//   * Adet / tutar: Satışlar › Hizmet Faturaları — aktif faturaların KasaPOS kalemleri
//     (crm_service_invoice_items), faturanın dönemine (period_month) göre. Kalem kümesi Canlı Ekran
//     cihaz sayacıyla AYNI (INTEGRATION_DEVICE_SERVICE_KEYS — tanım tek yerde). Tutar yalnız USD faturalardan.
//   * Aktif satış kasası: musteriler.aktif_satis_kasasi (migration 040), rapor ekranından girilir.

const KASAPOS_ITEM_FILTER = `
  s.status = 'active'
  and s.period_month >= make_date($1::int, 1, 1)
  and s.period_month < make_date($1::int + 1, 1, 1)
  and (lower(btrim(i.service_key)) = any($2::text[]) or lower(btrim(i.service_label)) = any($2::text[]))
`;

// ---- Repository ----

async function fetchInvoiceAggregates(year: number, keys: string[]): Promise<KasaposInvoiceAggregate[]> {
  const result = await db.query(
    `
      select s.customer_id::text as customer_id,
             extract(month from s.period_month)::int as ay,
             sum(i.quantity)::int as adet,
             coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)::numeric as tutar
      from public.crm_service_invoices s
      join public.crm_service_invoice_items i on i.invoice_id = s.id
      where ${KASAPOS_ITEM_FILTER}
      group by 1, 2
    `,
    [year, keys],
  );
  return (result.rows as any[]).map((row) => ({
    customerId: String(row.customer_id),
    ay: Number(row.ay),
    adet: Number(row.adet) || 0,
    tutar: round2(Number(row.tutar) || 0),
  }));
}

async function fetchFirmSources(year: number, keys: string[]): Promise<KasaposFirmSource[]> {
  const result = await db.query(
    `
      select m.id::text as customer_id, m.musteri, m.sorumlu, m.aktif_satis_kasasi,
             m.aktif_satis_kasasi_updated_at, m.aktif_satis_kasasi_updated_by
      from public.musteriler m
      where m.aktif_satis_kasasi is not null
         or exists (
           select 1
           from public.crm_service_invoices s
           join public.crm_service_invoice_items i on i.invoice_id = s.id
           where s.customer_id = m.id and ${KASAPOS_ITEM_FILTER}
         )
    `,
    [year, keys],
  );
  return (result.rows as any[]).map((row) => ({
    customerId: String(row.customer_id),
    musteri: String(row.musteri ?? '').trim(),
    sorumlu: String(row.sorumlu ?? '').trim() || null,
    aktifKasa: row.aktif_satis_kasasi != null ? Number(row.aktif_satis_kasasi) : null,
    aktifKasaUpdatedAt: row.aktif_satis_kasasi_updated_at ? new Date(row.aktif_satis_kasasi_updated_at).toISOString() : null,
    aktifKasaUpdatedBy: String(row.aktif_satis_kasasi_updated_by ?? '').trim() || null,
  }));
}

// ---- Servis ----

export async function buildKasaposEntegrasyonRaporu(options?: { year?: number }): Promise<KasaposEntegrasyonPayload> {
  const requested = options?.year;
  const year = Number.isInteger(requested) && requested! > 2000 ? requested! : new Date().getFullYear();
  const keys = [...INTEGRATION_DEVICE_SERVICE_KEYS];
  const [invoices, sources] = await Promise.all([fetchInvoiceAggregates(year, keys), fetchFirmSources(year, keys)]);
  return computeKasaposEntegrasyon(year, invoices, sources);
}

export async function updateAktifSatisKasasi(
  customerId: string,
  value: number | null,
  actor: { id?: string | null; email?: string | null; name: string },
) {
  const result = await db.query(
    `
      with prev as (select aktif_satis_kasasi from public.musteriler where id = $1::uuid)
      update public.musteriler
         set aktif_satis_kasasi = $2,
             aktif_satis_kasasi_updated_at = now(),
             aktif_satis_kasasi_updated_by = $3
       where id = $1::uuid
      returning (select aktif_satis_kasasi from prev) as onceki
    `,
    [customerId, value, actor.name],
  );
  if (!result.rowCount) return false;
  await tryRecordAuditEvent({
    actorId: actor.id ?? null,
    actorEmail: actor.email ?? null,
    action: 'customer.aktif_satis_kasasi.update',
    resourceType: 'customer',
    resourceId: customerId,
    before: { aktifSatisKasasi: (result.rows[0] as any)?.onceki ?? null },
    after: { aktifSatisKasasi: value },
  });
  return true;
}
