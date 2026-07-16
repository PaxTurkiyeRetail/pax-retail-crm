import { normalizeDurum } from '@/app/api/activities/_helpers';
import { createPgAdminClient } from '@/lib/pg/admin';

type BaseCustomerRow = {
  musteri_id: string;
};

type PhaseEventRow = {
  musteri_id: string;
  faz_no: number | null;
  durum: string | null;
  created_at: string | null;
};

type FazTanimiRow = {
  faz_no: number;
  asama_adi: string | null;
};

export type LastStayedPhaseFields = {
  son_kalinan_faz_no: number | null;
  son_kalinan_faz_adi: string | null;
  son_kalinan_faz_durumu: string | null;
  son_kalinan_faz_tarihi: string | null;
};

const EMPTY_LAST_PHASE: LastStayedPhaseFields = {
  son_kalinan_faz_no: null,
  son_kalinan_faz_adi: null,
  son_kalinan_faz_durumu: null,
  son_kalinan_faz_tarihi: null,
};

function isMeaningfulDurum(value: string | null | undefined) {
  const normalized = normalizeDurum(value);
  return Boolean(normalized && normalized !== 'Başlamadı');
}

export async function appendLastStayedPhase<T extends BaseCustomerRow>(rows: T[]): Promise<Array<T & LastStayedPhaseFields>> {
  const musteriIds = Array.from(new Set(rows.map((row) => String(row.musteri_id ?? '').trim()).filter(Boolean)));
  if (!musteriIds.length) return rows.map((row) => ({ ...row, ...EMPTY_LAST_PHASE }));

  const admin = createPgAdminClient();
  const { data: events, error: eventsError } = await admin
    .from('pipeline_eventleri')
    .select('musteri_id,faz_no,durum,created_at')
    .in('musteri_id', musteriIds)
    .not('durum', 'is', null)
    .order('created_at', { ascending: false });

  if (eventsError) {
    return rows.map((row) => ({ ...row, ...EMPTY_LAST_PHASE }));
  }

  const latestMeaningfulByCustomer = new Map<string, PhaseEventRow>();
  for (const event of (events ?? []) as PhaseEventRow[]) {
    const musteriId = String(event.musteri_id ?? '').trim();
    if (!musteriId || latestMeaningfulByCustomer.has(musteriId)) continue;
    if (!isMeaningfulDurum(event.durum)) continue;
    latestMeaningfulByCustomer.set(musteriId, event);
  }

  const fazNos = Array.from(new Set(Array.from(latestMeaningfulByCustomer.values()).map((row) => row.faz_no).filter((value): value is number => Number.isFinite(value))));
  const fazMap = new Map<number, string | null>();

  if (fazNos.length) {
    const { data: fazlar } = await admin
      .from('faz_tanimlari')
      .select('faz_no,asama_adi')
      .in('faz_no', fazNos);

    for (const faz of (fazlar ?? []) as FazTanimiRow[]) {
      fazMap.set(faz.faz_no, faz.asama_adi ?? null);
    }
  }

  return rows.map((row) => {
    const last = latestMeaningfulByCustomer.get(String(row.musteri_id ?? '').trim());
    if (!last) return { ...row, ...EMPTY_LAST_PHASE };
    const normalizedDurum = normalizeDurum(last.durum);
    const fazNo = Number.isFinite(last.faz_no) ? Number(last.faz_no) : null;
    return {
      ...row,
      son_kalinan_faz_no: fazNo,
      son_kalinan_faz_adi: fazNo != null ? (fazMap.get(fazNo) ?? null) : null,
      son_kalinan_faz_durumu: normalizedDurum,
      son_kalinan_faz_tarihi: last.created_at ?? null,
    };
  });
}
