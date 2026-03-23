import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { getKunyeStatus, mapKunyeDbToUi, normalizeKunyeStatusFilter } from '@/lib/kunye';
import { appendLastStayedPhase } from '@/lib/crm-phase-history';

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

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function phaseSearchText(phaseNo: number | null | undefined, phaseName: string | null | undefined) {
  if (phaseNo != null && phaseNo >= 1 && phaseNo <= 4) return `Fırsat ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 5 && phaseNo <= 9) return `İlk Temas ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 10 && phaseNo <= 14) return `Business ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 15 && phaseNo <= 23) return `Operasyon ${phaseName ?? ''} Faz ${phaseNo}`;
  if (phaseNo != null && phaseNo >= 24 && phaseNo <= 25) return `Yayılım ${phaseName ?? ''} Faz ${phaseNo}`;
  return `${phaseName ?? ''} Yazılım`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lite = url.searchParams.get('lite') === '1';
    const q = String(url.searchParams.get('q') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const sector = String(url.searchParams.get('sector') ?? '').trim();
    const integration = String(url.searchParams.get('integration') ?? '').trim();
    const kasaFirmasi = String(url.searchParams.get('kasa_firmasi') ?? '').trim();
    const kunyeStatus = normalizeKunyeStatusFilter(url.searchParams.get('kunye_status'));
    const fazNoRaw = String(url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), lite ? 200 : 10), lite ? 500 : 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    const supabase = await createSupabaseServerClient();
    await requireCrmAccessOrThrow();

    let query = supabase
      .from('vw_crm_musteriler')
      .select('*', { count: 'exact' })
      .order('musteri', { ascending: true })
      .limit(5000);

    if (owner) query = query.eq('sorumlu', owner);
    if (sector) query = query.eq('sektor', sector);
    if (integration) query = query.eq('entegrasyon_tipi', integration);
    if (Number.isFinite(fazNo)) query = query.eq('aktif_faz_no', fazNo);
    if (q && !lite) {
      const escaped = q.replace(/[,%]/g, ' ').trim();
      query = query.or([
        `musteri.ilike.%${escaped}%`,
        `sektor.ilike.%${escaped}%`,
        `sorumlu.ilike.%${escaped}%`,
        `aktif_faz_adi.ilike.%${escaped}%`,
      ].join(','));
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = data ?? [];
    const ids = rows.map((row: any) => row.musteri_id).filter(Boolean);
    const kunyeMap = new Map<string, any>();

    if (ids.length > 0) {
      const admin = createSupabaseAdminClient();
      const { data: kunyeler, error: kunyeErr } = await admin
        .from('musteri_kunye')
.select('musteri_id,magaza_sayisi,franchise_sayisi,sabit_kasa_yazilimi,toplam_pos_adedi,pos_modeli,erp,bankalar,pos_mulkiyet,pos_mulkiyet_bankalari,saha_hizmeti_firmasi')
        .in('musteri_id', ids);

      if (!kunyeErr || !/relation .* does not exist/i.test(kunyeErr.message)) {
        (kunyeler ?? []).forEach((item: any) => kunyeMap.set(item.musteri_id, item));
      }
    }

    let enriched = rows.map((row: any) => {
      const kunye = mapKunyeDbToUi(kunyeMap.get(row.musteri_id) ?? null);
      const status = getKunyeStatus({ ...kunye, firma_adi: row.musteri, has_kunye_record: Boolean(kunye) });
      return {
        ...row,
        kasa_firmasi: kunye?.sabit_kasa_yazilimi ?? null,
        kunye_missing_fields: status.missingFields,
        kunye_durumu: status.status,
        kunye_eksik_sayisi: status.missing,
      };
    });

    if (q) {
      const needle = normalizeSearchText(q);
      enriched = enriched.filter((row: any) => {
        return [
          row.musteri,
          row.sektor,
          row.sorumlu,
          row.aktif_faz_adi,
          row.entegrasyon_tipi,
          row.kasa_firmasi,
          row.kunye_durumu,
          phaseSearchText(row.aktif_faz_no, row.aktif_faz_adi),
        ].some((value) => normalizeSearchText(value).includes(needle));
      });
    }

    if (kasaFirmasi) {
      enriched = enriched.filter((row: any) => String(row.kasa_firmasi ?? '').trim() === kasaFirmasi);
    }

    if (kunyeStatus) {
      enriched = enriched.filter((row: any) => row.kunye_durumu === kunyeStatus);
    }

    const filteredTotal = enriched.length;
    const pagedRows = lite ? enriched.slice(0, pageSize) : enriched.slice(from, to);
    const rowsWithLastStayedPhase = await appendLastStayedPhase(pagedRows);

    return NextResponse.json({ rows: rowsWithLastStayedPhase, total: filteredTotal || (count ?? 0), page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
