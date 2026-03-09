import { NextResponse } from 'next/server';
import { requireReportsAccessOrThrow } from '@/lib/authz';
import { isAdminLike } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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

export async function GET() {
  try {
    const me = await requireReportsAccessOrThrow();

    const myName = (me.full_name ?? '').trim();
    if (!isAdminLike(me.role) && !myName) {
      return NextResponse.json(
        { message: 'Kullanıcı adı/soyadı boş. allowed_users.full_name doldurulmalı.' },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    let q = admin
      .from('vw_crm_musteriler')
      .select('musteri_id,musteri,sektor,entegrasyon_tipi,aktif_faz_no,aktif_faz_adi,sorumlu,son_not,bekleyen_taraf')
      .order('musteri', { ascending: true });

    if (!isAdminLike(me.role)) {
      q = q.eq('sorumlu', myName);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const rows = ((data ?? []) as BaseRow[]).map((r) => {
      const aktifFazNo = r.aktif_faz_no ?? null;
      const aktifFazAdi = (r.aktif_faz_adi ?? '').trim();
      const mevcutFaz = aktifFazNo != null ? `FAZ ${aktifFazNo}` : '-';
      const sonAksiyon = aktifFazAdi || '-';
      const sonrakiAdim = ((r.son_not ?? '').trim()) || '-';
      const bekleyenTaraf = ((r.bekleyen_taraf ?? '').trim()) || '-';

      return {
        musteri: (r.musteri ?? '').trim() || '-',
        sektor: (r.sektor ?? '').trim() || '-',
        entegrasyon_tipi: (r.entegrasyon_tipi ?? '').trim() || '-',
        mevcut_faz: mevcutFaz,
        son_aksiyon: sonAksiyon,
        sorumlu: (r.sorumlu ?? '').trim() || '-',
        risk_durumu: '-',
        sonraki_adim: sonrakiAdim,
        bekleyen_taraf: bekleyenTaraf,
      };
    });

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ message: 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
