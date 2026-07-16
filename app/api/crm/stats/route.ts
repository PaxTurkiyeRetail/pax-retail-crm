import { NextResponse } from 'next/server';
import { createPgServerClient } from '@/lib/pg/server';
import { createPgAdminClient } from '@/lib/pg/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { getKunyeStatus, mapKunyeDbToUi, normalizeKunyeStatusFilter } from '@/lib/kunye';
import { fetchAllByCustomerIds, fetchAllRows } from '@/lib/reporting';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[I]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeIlike(value: string) {
  return String(value ?? '').replace(/[\%_]/g, ' ').trim();
}

function phaseSearchText(phaseNo: number | null | undefined) {
  if (phaseNo != null && phaseNo >= 1 && phaseNo <= 4) return `Fırsat İlk Temas Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 5 && phaseNo <= 9) return `Analiz + Sunumlar Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 10 && phaseNo <= 14) return `Business Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 15 && phaseNo <= 23) return `Operasyon Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 24 && phaseNo <= 25) return `Yayılım Faz ${phaseNo}`;
  return 'Yazılım';
}

function unique(values: Array<string | null | undefined>) {
  return new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean)).size;
}

function toSummary(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));
}

export async function GET(request: Request) {
  try {
    await requireCrmAccessOrThrow();
    const url = new URL(request.url);
    const q = String(url.searchParams.get('q') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const sector = String(url.searchParams.get('sector') ?? '').trim();
    const integration = String(url.searchParams.get('integration') ?? '').trim();
    const kasaFirmasi = String(url.searchParams.get('kasa_firmasi') ?? '').trim();
    const kunyeStatus = normalizeKunyeStatusFilter(url.searchParams.get('kunye_status'));
    const fazNoRaw = String(url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;

    const pgClient = await createPgServerClient();
    const rawBaseRows = await fetchAllRows<any>((from, to) => {
      let qy = pgClient
        .from('vw_crm_musteriler')
        .select('musteri_id,sektor,sorumlu,entegrasyon_tipi,aktif_faz_no,musteri')
        .order('musteri', { ascending: true })
        .range(from, to);
      if (owner) qy = qy.ilike('sorumlu', escapeIlike(owner));
      if (sector) qy = qy.ilike('sektor', escapeIlike(sector));
      // entegrasyon_tipi enum oldugu icin DB tarafinda ilike kullanilmaz; asagida JS filtresi uygulanir.
      if (Number.isFinite(fazNo)) qy = qy.eq('aktif_faz_no', fazNo);
      // q filtresi asagida normalize edilerek uygulaniyor.
      // Boylece musteri aramalarinda buyuk-kucuk harf ve Turkce karakter
      // farklari nedeniyle kayit kacirma problemi yasamiyoruz.
      return qy;
    });

    const baseRows = rawBaseRows.filter((row: any) => !isReportOnlyCustomer(row));

    const admin = createPgAdminClient();
    const ids = baseRows.map((row: any) => String(row.musteri_id ?? '').trim()).filter(Boolean);
    const kunyeler = ids.length
      ? await fetchAllByCustomerIds<any>(
          admin,
          'v_musteri_kunye_status',
          '*',
          ids,
        )
      : [];

    const kuyeMap = new Map((kunyeler ?? []).map((row: any) => [row.musteri_id, row]));
    let enriched = baseRows.map((row: any) => {
      const rawKunye = kuyeMap.get(row.musteri_id) ?? null;
      const kunye = mapKunyeDbToUi(rawKunye);
      const status = getKunyeStatus({ ...kunye, ...(rawKunye ?? {}), firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        ...(kunye ?? null),
        kasa_firmasi: kunye?.kasapos_firmasi ?? null,
        kunye_durumu: status.status,
        kunye_eksik_sayisi: status.missing,
        kunye_missing_fields: status.missingFields,
        kunye_completion_pct: status.completionPct ?? null,
      };
    });

    if (q) {
      const needle = normalizeSearchText(q);
      enriched = enriched.filter((row: any) => [
        row.musteri,
        row.sektor,
        row.sorumlu,
        row.entegrasyon_tipi,
        phaseSearchText(row.aktif_faz_no),
      ].some((value) => normalizeSearchText(value).includes(needle)));
    }

    if (integration) {
      const integrationNeedle = normalizeSearchText(integration);
      enriched = enriched.filter((row: any) => normalizeSearchText(row.entegrasyon_tipi).includes(integrationNeedle));
    }

    if (kasaFirmasi) {
      const kasaNeedle = normalizeSearchText(kasaFirmasi);
      enriched = enriched.filter((row: any) => normalizeSearchText(row.kasa_firmasi).includes(kasaNeedle));
    }

    if (kunyeStatus) {
      const kunyeNeedle = normalizeSearchText(kunyeStatus);
      enriched = enriched.filter((row: any) => normalizeSearchText(row.kunye_durumu).includes(kunyeNeedle));
    }

    const missingBreakdown = {
      firma_adi: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('firma_adi')).length,
      magaza_veya_franchise: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('magaza_veya_franchise')).length,
      pos_modeli: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('pos_modeli')).length,
      toplam_pos_adedi: enriched.filter((row: any) => row.kunye_durumu === 'Eksik' && row.kunye_missing_fields?.includes('toplam_pos_adedi')).length,
    };

    return NextResponse.json({
      total: enriched.length,
      sectors: unique(enriched.map((row: any) => row.sektor)),
      kasaFirmasi: unique(enriched.map((row: any) => row.kasa_firmasi)),
      accounts: unique(enriched.map((row: any) => row.sorumlu)),
      entegrasyonYapisi: unique(enriched.map((row: any) => row.entegrasyon_tipi)),
      kunyeVar: enriched.filter((row: any) => row.kunye_durumu === 'Var').length,
      kunyeEksik: enriched.filter((row: any) => row.kunye_durumu === 'Eksik').length,
      kunyeYok: enriched.filter((row: any) => row.kunye_durumu === 'Yok').length,
      byPhase: toSummary(enriched.map((row: any) => row.aktif_faz_no != null ? `FAZ ${row.aktif_faz_no}` : 'Fazsız')),
      byOwner: toSummary(enriched.map((row: any) => row.sorumlu)),
      bySector: toSummary(enriched.map((row: any) => row.sektor || '-')),
      missingBreakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: e?.status || 401 });
  }
}
