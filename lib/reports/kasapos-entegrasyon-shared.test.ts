import { describe, expect, it } from 'vitest';
import { computeKasaposEntegrasyon, type KasaposFirmSource } from './kasapos-entegrasyon-shared';

// Müdür raporu (PDF 28.09.2026) formülleri: kullanım %, fırsat, potansiyel, eksik ay.

const firm = (customerId: string, aktifKasa: number | null): KasaposFirmSource => ({
  customerId, musteri: customerId, sorumlu: null, aktifKasa, aktifKasaUpdatedAt: null, aktifKasaUpdatedBy: null,
});

describe('computeKasaposEntegrasyon', () => {
  const payload = computeKasaposEntegrasyon(
    2026,
    [
      { customerId: 'KIGILI', ay: 8, adet: 302, tutar: 1963 },
      { customerId: 'KIGILI', ay: 9, adet: 302, tutar: 1963 },
      { customerId: 'EVKUR', ay: 9, adet: 201, tutar: 804 },
      { customerId: 'MARKAPARK', ay: 8, adet: 18, tutar: 144 },
    ],
    [firm('KIGILI', 400), firm('EVKUR', 201), firm('MARKAPARK', 21), firm('YENI', null)],
  );
  const by = (id: string) => payload.firms.find((row) => row.customerId === id)!;

  it('referans ay = verisi olan son ay', () => {
    expect(payload.refMonthIndex).toBe(8);
    expect(payload.months).toHaveLength(9);
  });

  it('kullanım, fırsat ve potansiyel PDF formülüyle', () => {
    expect(by('KIGILI')).toMatchObject({ kullanimPct: 76, firsatAdet: 98, birimFiyat: 6.5, potansiyel: 637 });
    expect(by('EVKUR')).toMatchObject({ kullanimPct: 100, firsatAdet: 0, potansiyel: 0 });
  });

  it('referans ayda faturası olmayan firma "Yok" (eksikAy) ve son fiyattan fırsat', () => {
    expect(by('MARKAPARK')).toMatchObject({ refAdet: 0, eksikAy: true, kullanimPct: 0, firsatAdet: 21, potansiyel: 168 });
  });

  it('aktif kasa girilmemişse fatura adedi kullanılmaz (Girilmedi)', () => {
    const p = computeKasaposEntegrasyon(2026, [{ customerId: 'X', ay: 9, adet: 33, tutar: 264 }], [firm('X', null)]);
    expect(p.firms[0]).toMatchObject({ aktifKasa: null, refAdet: 33, kullanimPct: null, firsatAdet: null });
  });

  it('KPI toplamları; kasası girilmeyen firma hariç', () => {
    expect(payload.kpi).toMatchObject({
      refAdet: 503, aktifKasaToplam: 622, faturalananAktif: 503, firsatAdet: 119, potansiyel: 805, kasaGirilmemisFirma: 1,
    });
  });
});
