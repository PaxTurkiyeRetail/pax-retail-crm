import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getKunyeStatus } from '@/lib/kunye';
import { activityLabelFromRow, isDisplayableActivityRow, presentDurum } from '@/app/api/activities/_helpers';
import { getSlaState } from '@/lib/sla';

type BaseRow = {
  musteri_id: string | null;
  musteri: string | null;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  aktif_faz_no: number | null;
  aktif_faz_adi: string | null;
  sorumlu: string | null;
  son_not: string | null;
  bekleyen_taraf: string | null;
};

function summarize(rows: any[], key: string, limit = 5) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, row) => {
    const label = String(row?.[key] ?? '-').trim() || '-';
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, value]) => ({ label, value }));
}

export async function GET() {
  try {
    const me = await requireReportsAccessOrThrow();

    const myName = (me.full_name ?? '').trim();
    if (!isAdminLike(me.role) && !myName) {
      return NextResponse.json({ message: 'Kullanıcı adı/soyadı boş. allowed_users.full_name doldurulmalı.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    let q = admin
      .from('vw_crm_musteriler')
      .select('musteri_id,musteri,sektor,entegrasyon_tipi,aktif_faz_no,aktif_faz_adi,sorumlu,son_not,bekleyen_taraf')
      .order('musteri', { ascending: true });

    if (!isAdminLike(me.role)) q = q.eq('sorumlu', myName);

    const { data, error } = await q;
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    const baseRows = (data ?? []) as BaseRow[];
    const ids = baseRows.map((r) => r.musteri_id).filter(Boolean) as string[];
    const kunyeMap = new Map<string, any>();
    const latestActivityMap = new Map<string, any>();

    if (ids.length) {
      const [{ data: kunyeler }, { data: activities }] = await Promise.all([
        admin
          .from('musteri_kunye')
          .select('musteri_id,franchise_sayisi,kasapos_firmasi,magaza_sayisi,erp,pos_modeli,toplam_pos_adedi,bankalar,pos_mulkiyet')
          .in('musteri_id', ids),
        admin
          .from('pipeline_eventleri')
          .select('musteri_id,durum,aksiyon,owner,partner_owner,created_at,hedef_tarihi,notlar')
          .in('musteri_id', ids)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      (kunyeler ?? []).forEach((row: any) => kunyeMap.set(row.musteri_id, row));
      for (const row of activities ?? []) {
        if (!row?.musteri_id || latestActivityMap.has(row.musteri_id)) continue;
        if (!isDisplayableActivityRow(row)) continue;
        latestActivityMap.set(row.musteri_id, {
          ...row,
          activity_label: activityLabelFromRow(row),
          activity_status: presentDurum(row.durum),
        });
      }
    }

    const rows = baseRows.map((r) => {
      const aktifFazNo = r.aktif_faz_no ?? null;
      const mevcutFaz = aktifFazNo != null ? `FAZ ${aktifFazNo}` : '-';
      const bekleyenTaraf = ((r.bekleyen_taraf ?? '').trim()) || '-';
      const kunye = r.musteri_id ? kunyeMap.get(r.musteri_id) ?? null : null;
      const kunyeDurum = getKunyeStatus({ ...(kunye ?? {}), firma_adi: r.musteri }).status;
      const latestActivity = r.musteri_id ? latestActivityMap.get(r.musteri_id) ?? null : null;
      const slaState = getSlaState(latestActivity?.hedef_tarihi ?? null, latestActivity?.activity_status ?? null);
      return {
        musteri: (r.musteri ?? '').trim() || '-',
        sektor: (r.sektor ?? '').trim() || '-',
        entegrasyon_tipi: (r.entegrasyon_tipi ?? '').trim() || '-',
        mevcut_faz: mevcutFaz,
        son_aksiyon: latestActivity?.activity_label || (r.aktif_faz_adi ?? '').trim() || '-',
        sorumlu: (r.sorumlu ?? '').trim() || '-',
        satis_olasiligi_durumu: '-',
        sonraki_adim: ((r.son_not ?? '').trim()) || '-',
        bekleyen_taraf: bekleyenTaraf,
        kunye_durumu: kunyeDurum,
        sla_state: slaState,
      };
    });

    const totals = {
      toplam_musteri: rows.length,
      hamwe_kunye_var: rows.filter((r) => r.kunye_durumu === 'Var').length,
      hamwe_kunye_eksik: rows.filter((r) => r.kunye_durumu === 'Eksik').length,
      hamwe_kunye_yok: rows.filter((r) => r.kunye_durumu === 'Yok').length,
      sla_geciken: rows.filter((r) => r.sla_state === 'overdue').length,
      sla_bugun: rows.filter((r) => r.sla_state === 'today').length,
      sla_planli: rows.filter((r) => r.sla_state === 'upcoming').length,
      sla_tarihsiz: rows.filter((r) => r.sla_state === 'unscheduled').length,
    };

    return NextResponse.json({
      rows,
      totals,
      highlights: {
        owners: summarize(rows, 'sorumlu'),
        waiting: summarize(rows, 'bekleyen_taraf'),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
