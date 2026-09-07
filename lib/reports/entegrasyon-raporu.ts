import 'server-only';
import { db } from '@/lib/db';

// Entegrasyon Raporu — Entegrasyon Firması olarak işaretli iş ortaklarının
// hangi fazda olduğunu ve son aktivite notunu tek ekranda gösterir.
// Kaynak: organization_roles (business_partner / Entegrasyon Firması) + bağlamsal pipeline
// (aktif_faz_no) + is_ortagi_faz_tanimlari (14 fazlı iş ortağı akışı) +
// pipeline_eventleri (en son not).

export type EntegrasyonRaporuRow = {
  customerId: string;
  musteri: string;
  isKolu: string | null;
  aktifFazNo: number | null;
  aktifFazAdi: string | null;
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
        m.id::text as customer_id,
        m.musteri,
        m.is_kolu,
        mp.active_phase_no as aktif_faz_no,
        ft.asama_adi as aktif_faz_adi,
        pe.notlar as son_not,
        pe.created_at as son_event_tarihi
      from public.musteriler m
      join public.organization_roles r on r.customer_id=m.id and r.role_key='business_partner' and r.is_active=true
      left join public.organization_pipeline_states mp on mp.customer_id = m.id and mp.context_key='business_partner'
      left join public.is_ortagi_faz_tanimlari ft on ft.faz_no = mp.active_phase_no
      left join lateral (
        select pe_1.notlar, pe_1.created_at
        from public.pipeline_eventleri pe_1
        where pe_1.musteri_id = m.id and pe_1.activity_context='business_partner'
        order by pe_1.created_at desc
        limit 1
      ) pe on true
      where r.subtype = 'Entegrasyon Firması'
      order by m.musteri asc
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
      aktifFazNo: row.aktif_faz_no != null ? Number(row.aktif_faz_no) : null,
      aktifFazAdi: cleanText(row.aktif_faz_adi),
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
