import 'server-only';
import { db } from '@/lib/db';

// Entegrasyon Raporu — entegrasyon yeteneği açık tüm firmaların (müşteri veya
// iş ortağı) hangi fazda olduğunu ve son aktivite notunu tek ekranda gösterir.
// Kaynak: `crm_entegrasyon_durumu` görünümü (migration 037) — Canlı Ekran'ın entegrasyon
// sayacıyla AYNI tanım (altın kural 17): iş ortağı → iş ortağı fazı, son müşteri → müşteri
// fazı; "tamamlandı" eşiği de oradan (iş ortağı >=10, müşteri >=24). Son not, firmanın KENDİ
// bağlamındaki (`entegrasyon_modeli`ne göre) en son pipeline olayından — 16.09 öncesi bu satır
// her firma için sabit `business_partner` bağlamına bakıyordu; son müşterilerin notu hiç
// gelmiyordu (aynı kök sebep, aynı düzeltme).

export type EntegrasyonRaporuRow = {
  customerId: string;
  musteri: string;
  isKolu: string | null;
  entegrasyonModeli: string;
  aktifFazNo: number | null;
  aktifFazAdi: string | null;
  entegrasyonTamamlandi: boolean;
  sonNot: string | null;
  sonEventTarihi: string | null;
};

export type EntegrasyonRaporuPayload = {
  filters: { isKolu: string };
  summary: { total: number };
  rows: EntegrasyonRaporuRow[];
  isKoluOptions: string[];
};

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function buildEntegrasyonRaporu(options?: { isKolu?: string }): Promise<EntegrasyonRaporuPayload> {
  const isKolu = String(options?.isKolu ?? '').trim();

  const result = await db.query(
    `
      select
        d.customer_id::text as customer_id,
        d.musteri,
        d.is_kolu,
        case when d.is_ortagi_rolu then 'İş Ortağı' else 'Müşteri (Kendi Entegrasyonu)' end as entegrasyon_modeli,
        d.aktif_faz_no,
        d.aktif_faz_adi,
        d.entegrasyon_tamamlandi,
        pe.notlar as son_not,
        pe.created_at as son_event_tarihi
      from public.crm_entegrasyon_durumu d
      left join lateral (
        select pe_1.notlar, pe_1.created_at
        from public.pipeline_eventleri pe_1
        where pe_1.musteri_id = d.customer_id and pe_1.activity_context = d.aktif_baglam
        order by pe_1.created_at desc
        limit 1
      ) pe on true
      order by d.musteri asc
    `,
  );

  const allRows = result.rows as any[];
  const isKoluOptions = Array.from(
    new Set(allRows.map((row) => String(row.is_kolu ?? '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'tr'));

  const rows: EntegrasyonRaporuRow[] = allRows
    .filter((row) => !isKolu || String(row.is_kolu ?? '').trim() === isKolu)
    .map((row) => ({
      customerId: String(row.customer_id),
      musteri: String(row.musteri ?? '').trim(),
      isKolu: cleanText(row.is_kolu),
      entegrasyonModeli: String(row.entegrasyon_modeli),
      aktifFazNo: row.aktif_faz_no != null ? Number(row.aktif_faz_no) : null,
      aktifFazAdi: cleanText(row.aktif_faz_adi),
      entegrasyonTamamlandi: row.entegrasyon_tamamlandi === true,
      sonNot: cleanText(row.son_not),
      sonEventTarihi: row.son_event_tarihi ? new Date(row.son_event_tarihi).toISOString() : null,
    }));

  return {
    filters: { isKolu },
    summary: { total: rows.length },
    rows,
    isKoluOptions,
  };
}
