import 'server-only';
import { db } from '@/lib/db';
import { INTEGRATION_DEVICE_SERVICE_KEYS } from '@/lib/sales/service-invoices-shared';

// KasaPOS Entegrasyon Raporu — müdür raporu (PDF 28.09.2026) birebir sistemden.
// Kaynaklar:
//   * Adet / tutar: aktif hizmet faturalarının KasaPOS kalemleri (crm_service_invoice_items),
//     faturanın dönemine (period_month) göre. Kalem kümesi Canlı Ekran cihaz sayacıyla AYNI
//     (INTEGRATION_DEVICE_SERVICE_KEYS — tanım tek yerde). Tutar yalnız USD faturalardan.
//   * Aktif satış kasası: musteriler.aktif_satis_kasasi (migration 040), rapor ekranından girilir.
// Hesaplar (referans ay = seçilen yılın verisi olan son ayı):
//   kullanım % = ref ay adedi ÷ aktif satış kasası
//   fırsat     = max(aktif satış kasası − ref ay adedi, 0)
//   potansiyel = fırsat × firmanın son faturalı ayındaki birim fiyat (tutar ÷ adet)

export type KasaposMonthCell = { adet: number; tutar: number } | null;

export type KasaposFirmRow = {
  customerId: string;
  musteri: string;
  sorumlu: string | null;
  aktifKasa: number | null;
  aktifKasaUpdatedAt: string | null;
  aktifKasaUpdatedBy: string | null;
  monthly: KasaposMonthCell[];
  toplamAdet: number;
  toplamTutar: number;
  refAdet: number;
  refTutar: number;
  birimFiyat: number | null;
  kullanimPct: number | null;
  firsatAdet: number | null;
  potansiyel: number | null;
  /** Önceki ay faturalı, referans ayda faturası yok. */
  eksikAy: boolean;
};

export type KasaposEntegrasyonPayload = {
  year: number;
  months: string[];
  refMonthIndex: number;
  monthlyTotals: Array<{ adet: number; tutar: number; firma: number }>;
  kpi: {
    refAdet: number;
    refTutar: number;
    prevAdet: number;
    prevTutar: number;
    aktifKasaToplam: number;
    faturalananAktif: number;
    kullanimPct: number | null;
    firsatAdet: number;
    potansiyel: number;
    tamKullanimTutar: number;
    kasaGirilmemisFirma: number;
  };
  firms: KasaposFirmRow[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildKasaposEntegrasyonRaporu(options?: { year?: number }): Promise<KasaposEntegrasyonPayload> {
  const now = new Date();
  const year = Number.isInteger(options?.year) && options!.year! > 2000 ? options!.year! : now.getFullYear();
  const keys = [...INTEGRATION_DEVICE_SERVICE_KEYS];

  const [invoiceResult, kasaResult] = await Promise.all([
    db.query(
      `
        select s.customer_id::text as customer_id,
               extract(month from s.period_month)::int as ay,
               sum(i.quantity)::int as adet,
               coalesce(sum(i.total_price) filter (where s.currency = 'USD'), 0)::numeric as tutar
        from public.crm_service_invoices s
        join public.crm_service_invoice_items i on i.invoice_id = s.id
        where s.status = 'active'
          and s.period_month >= make_date($1::int, 1, 1)
          and s.period_month < make_date($1::int + 1, 1, 1)
          and (lower(btrim(i.service_key)) = any($2::text[]) or lower(btrim(i.service_label)) = any($2::text[]))
        group by 1, 2
      `,
      [year, keys],
    ),
    db.query(
      `
        select m.id::text as customer_id, m.musteri, m.sorumlu, m.aktif_satis_kasasi,
               m.aktif_satis_kasasi_updated_at, m.aktif_satis_kasasi_updated_by
        from public.musteriler m
        where m.aktif_satis_kasasi is not null
           or exists (
             select 1
             from public.crm_service_invoices s
             join public.crm_service_invoice_items i on i.invoice_id = s.id
             where s.customer_id = m.id and s.status = 'active'
               and s.period_month >= make_date($1::int, 1, 1)
               and s.period_month < make_date($1::int + 1, 1, 1)
               and (lower(btrim(i.service_key)) = any($2::text[]) or lower(btrim(i.service_label)) = any($2::text[]))
           )
      `,
      [year, keys],
    ),
  ]);

  const invoiceRows = invoiceRows_(invoiceResult.rows as any[]);
  const lastDataMonth = invoiceRows.reduce((max, row) => Math.max(max, row.ay), 0);
  const monthCount = Math.max(lastDataMonth, 1);
  const refIdx = monthCount - 1;
  const months = Array.from({ length: monthCount }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`);

  const byCustomer = new Map<string, KasaposMonthCell[]>();
  for (const row of invoiceRows) {
    const cells = byCustomer.get(row.customerId) ?? Array.from({ length: monthCount }, () => null as KasaposMonthCell);
    cells[row.ay - 1] = { adet: row.adet, tutar: row.tutar };
    byCustomer.set(row.customerId, cells);
  }

  const firms: KasaposFirmRow[] = (kasaResult.rows as any[]).map((row) => {
    const monthly = byCustomer.get(String(row.customer_id)) ?? Array.from({ length: monthCount }, () => null as KasaposMonthCell);
    const toplamAdet = monthly.reduce((sum, cell) => sum + (cell?.adet ?? 0), 0);
    const toplamTutar = round2(monthly.reduce((sum, cell) => sum + (cell?.tutar ?? 0), 0));
    const refCell = monthly[refIdx];
    const refAdet = refCell?.adet ?? 0;
    const refTutar = refCell?.tutar ?? 0;
    const lastCell = [...monthly].reverse().find((cell) => cell && cell.adet > 0 && cell.tutar > 0) ?? null;
    const birimFiyat = lastCell ? round2(lastCell.tutar / lastCell.adet) : null;
    const aktifKasa = row.aktif_satis_kasasi != null ? Number(row.aktif_satis_kasasi) : null;
    const kullanimPct = aktifKasa && aktifKasa > 0 ? Math.round((refAdet / aktifKasa) * 100) : null;
    const firsatAdet = aktifKasa != null ? Math.max(aktifKasa - refAdet, 0) : null;
    const potansiyel = firsatAdet != null && birimFiyat != null ? round2(firsatAdet * birimFiyat) : null;
    const prevCell = refIdx > 0 ? monthly[refIdx - 1] : null;
    return {
      customerId: String(row.customer_id),
      musteri: String(row.musteri ?? '').trim(),
      sorumlu: String(row.sorumlu ?? '').trim() || null,
      aktifKasa,
      aktifKasaUpdatedAt: row.aktif_satis_kasasi_updated_at ? new Date(row.aktif_satis_kasasi_updated_at).toISOString() : null,
      aktifKasaUpdatedBy: String(row.aktif_satis_kasasi_updated_by ?? '').trim() || null,
      monthly,
      toplamAdet,
      toplamTutar,
      refAdet,
      refTutar,
      birimFiyat,
      kullanimPct,
      firsatAdet,
      potansiyel,
      eksikAy: Boolean(prevCell && prevCell.adet > 0 && !refCell),
    };
  });

  firms.sort((a, b) => b.refAdet - a.refAdet || b.toplamAdet - a.toplamAdet || a.musteri.localeCompare(b.musteri, 'tr'));

  const monthlyTotals = months.map((_, idx) => {
    let adet = 0;
    let tutar = 0;
    let firma = 0;
    for (const firm of firms) {
      const cell = firm.monthly[idx];
      if (cell && cell.adet > 0) {
        adet += cell.adet;
        tutar += cell.tutar;
        firma += 1;
      }
    }
    return { adet, tutar: round2(tutar), firma };
  });

  const withKasa = firms.filter((firm) => firm.aktifKasa != null);
  const aktifKasaToplam = withKasa.reduce((sum, firm) => sum + (firm.aktifKasa ?? 0), 0);
  const faturalananAktif = withKasa.reduce((sum, firm) => sum + firm.refAdet, 0);
  const firsatAdet = withKasa.reduce((sum, firm) => sum + (firm.firsatAdet ?? 0), 0);
  const potansiyel = round2(withKasa.reduce((sum, firm) => sum + (firm.potansiyel ?? 0), 0));
  const ref = monthlyTotals[refIdx] ?? { adet: 0, tutar: 0 };
  const prev = refIdx > 0 ? monthlyTotals[refIdx - 1] : { adet: 0, tutar: 0 };

  return {
    year,
    months,
    refMonthIndex: refIdx,
    monthlyTotals,
    kpi: {
      refAdet: ref.adet,
      refTutar: ref.tutar,
      prevAdet: prev.adet,
      prevTutar: prev.tutar,
      aktifKasaToplam,
      faturalananAktif,
      kullanimPct: aktifKasaToplam > 0 ? Math.round((faturalananAktif / aktifKasaToplam) * 100) : null,
      firsatAdet,
      potansiyel,
      tamKullanimTutar: round2(ref.tutar + potansiyel),
      kasaGirilmemisFirma: firms.length - withKasa.length,
    },
    firms,
  };
}

function invoiceRows_(rows: any[]) {
  return rows.map((row) => ({
    customerId: String(row.customer_id),
    ay: Number(row.ay),
    adet: Number(row.adet) || 0,
    tutar: round2(Number(row.tutar) || 0),
  }));
}

export async function updateAktifSatisKasasi(customerId: string, value: number | null, actor: string) {
  const result = await db.query(
    `
      update public.musteriler
         set aktif_satis_kasasi = $2,
             aktif_satis_kasasi_updated_at = now(),
             aktif_satis_kasasi_updated_by = $3
       where id = $1::uuid
      returning id
    `,
    [customerId, value, actor],
  );
  return result.rowCount ? true : false;
}
