// KasaPOS Entegrasyon Raporu — saf hesap katmanı (DB yok; client + test güvenli).
// Müdür raporu (PDF 28.09.2026) formülleri (referans ay = seçilen yılın verisi olan son ayı):
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

/** Repository çıktısı: müşteri × ay KasaPOS kalem toplamı (Hizmet Faturaları). */
export type KasaposInvoiceAggregate = { customerId: string; ay: number; adet: number; tutar: number };

/** Repository çıktısı: rapora giren firma + aktif satış kasası. */
export type KasaposFirmSource = {
  customerId: string;
  musteri: string;
  sorumlu: string | null;
  aktifKasa: number | null;
  aktifKasaUpdatedAt: string | null;
  aktifKasaUpdatedBy: string | null;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeKasaposEntegrasyon(
  year: number,
  invoices: KasaposInvoiceAggregate[],
  sources: KasaposFirmSource[],
): KasaposEntegrasyonPayload {
  const lastDataMonth = invoices.reduce((max, row) => Math.max(max, row.ay), 0);
  const monthCount = Math.max(lastDataMonth, 1);
  const refIdx = monthCount - 1;
  const months = Array.from({ length: monthCount }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`);
  const emptyCells = () => Array.from({ length: monthCount }, () => null as KasaposMonthCell);

  const byCustomer = new Map<string, KasaposMonthCell[]>();
  for (const row of invoices) {
    if (row.ay < 1 || row.ay > monthCount) continue;
    const cells = byCustomer.get(row.customerId) ?? emptyCells();
    cells[row.ay - 1] = { adet: row.adet, tutar: round2(row.tutar) };
    byCustomer.set(row.customerId, cells);
  }

  const firms: KasaposFirmRow[] = sources.map((src) => {
    const monthly = byCustomer.get(src.customerId) ?? emptyCells();
    const toplamAdet = monthly.reduce((sum, cell) => sum + (cell?.adet ?? 0), 0);
    const toplamTutar = round2(monthly.reduce((sum, cell) => sum + (cell?.tutar ?? 0), 0));
    const refCell = monthly[refIdx];
    const refAdet = refCell?.adet ?? 0;
    const refTutar = refCell?.tutar ?? 0;
    const lastCell = [...monthly].reverse().find((cell) => cell && cell.adet > 0 && cell.tutar > 0) ?? null;
    const birimFiyat = lastCell ? round2(lastCell.tutar / lastCell.adet) : null;
    // Aktif satış kasası: formdan girilen değer; yoksa firmanın son Hizmet Faturası KasaPOS adedi.
    const lastAdetCell = [...monthly].reverse().find((cell) => cell && cell.adet > 0) ?? null;
    const aktifKasa = src.aktifKasa ?? lastAdetCell?.adet ?? null;
    const kullanimPct = aktifKasa && aktifKasa > 0 ? Math.round((refAdet / aktifKasa) * 100) : null;
    const firsatAdet = aktifKasa != null ? Math.max(aktifKasa - refAdet, 0) : null;
    const potansiyel = firsatAdet != null && birimFiyat != null ? round2(firsatAdet * birimFiyat) : null;
    const prevCell = refIdx > 0 ? monthly[refIdx - 1] : null;
    return {
      ...src,
      aktifKasa,
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
