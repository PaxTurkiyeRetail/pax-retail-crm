import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireCrmAccessOrThrow } from '@/lib/authz';
import { getKunyeStatus } from '@/lib/kunye';

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lite = url.searchParams.get('lite') === '1';
    const q = String(url.searchParams.get('q') ?? '').trim();
    const owner = String(url.searchParams.get('owner') ?? '').trim();
    const sector = String(url.searchParams.get('sector') ?? '').trim();
    const integration = String(url.searchParams.get('integration') ?? '').trim();
    const kunyeStatus = String(url.searchParams.get('kunye_status') ?? '').trim();
    const fazNoRaw = String(url.searchParams.get('faz_no') ?? '').trim();
    const fazNo = fazNoRaw ? Number(fazNoRaw) : NaN;
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get('pageSize'), lite ? 200 : 10), lite ? 500 : 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = await createSupabaseServerClient();
    await requireCrmAccessOrThrow();

    let query = supabase
      .from('vw_crm_musteriler')
      .select(lite ? 'musteri_id,musteri,sorumlu,aktif_faz_no,aktif_faz_adi,entegrasyon_tipi,sektor' : '*', { count: 'exact' })
      .order('musteri', { ascending: true });

    if (owner) query = query.eq('sorumlu', owner);
    if (sector) query = query.eq('sektor', sector);
    if (integration) query = query.eq('entegrasyon_tipi', integration);
    if (Number.isFinite(fazNo)) query = query.eq('aktif_faz_no', fazNo);
    if (q) {
      const escaped = q.replace(/[,%]/g, ' ').trim();
      query = query.or([
        `musteri.ilike.%${escaped}%`,
        `sektor.ilike.%${escaped}%`,
        `sorumlu.ilike.%${escaped}%`,
        `aktif_faz_adi.ilike.%${escaped}%`,
      ].join(','));
    }
    if (!lite) query = query.range(from, to);
    else query = query.limit(pageSize);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const rows = data ?? [];
    const ids = rows.map((row: any) => row.musteri_id).filter(Boolean);
    const kunyeMap = new Map<string, any>();

    if (ids.length > 0) {
      const admin = createSupabaseAdminClient();
      const { data: kunyeler, error: kunyeErr } = await admin
        .from('musteri_kunye')
        .select('musteri_id,franchise_sayisi,magaza_sayisi,kasapos_firmasi,toplam_pos_adedi,pos_modeli,erp,bankalar,pos_mulkiyet,pos_mulkiyet_bankalari,saha_hizmeti_firmasi')
        .in('musteri_id', ids);

      if (!kunyeErr || !/relation .* does not exist/i.test(kunyeErr.message)) {
        (kunyeler ?? []).forEach((item: any) => kunyeMap.set(item.musteri_id, item));
      }
    }

    const enriched = rows.map((row: any) => {
      const kunye = kunyeMap.get(row.musteri_id) ?? null;
      const status = getKunyeStatus({
        ...(kunye ?? {}),
        firma_adi: row.musteri,
      });
      return {
        ...row,
        kasa_firmasi: kunye?.kasapos_firmasi ?? null,
        kunye_durumu: status.status,
        kunye_eksik_sayisi: status.missing,
      };
    }).filter((row: any) => (kunyeStatus ? row.kunye_durumu === kunyeStatus : true));

    const filteredTotal = kunyeStatus ? enriched.length : (count ?? enriched.length);
    const pagedRows = lite || !kunyeStatus ? enriched : enriched.slice(0, pageSize);

    return NextResponse.json({ rows: pagedRows, total: filteredTotal, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
