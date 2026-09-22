import { buildLiveBoard } from '@/lib/reports/live-board';

export type YilZiyaretPortfoyRow = {
  owner: string;
  initials: string;
  visitsYear: { actual: number; target: number | null; pct: number | null };
  portfolio: { total: number; active: number; farmer: number; hunter: number; kasa: number };
  coverage: {
    coveredCustomers: number;
    contactsPer: { actual: number; target: number | null; pct: number | null };
    activitiesYear: number;
  };
  inactive: { count: number; days: number; unmatched: number };
};

export type YilZiyaretPortfoyPayload = {
  generatedAt: string;
  rows: YilZiyaretPortfoyRow[];
};

// Yıl Ziyaret & Portföy Sağlığı Raporu — Canlı Ekran'daki "Aktivite Hedefi" (yıl ziyaret) ve
// "Portföy Sağlığı" kartlarının tüm satışçılar için tek tabloda toplu görünümü (22.09).
// Ayrı sorgu YOK: veri zaten buildLiveBoard() içinde owner bazlı hesaplı — burada sadece
// ilgili alanlar seçilip düzleştiriliyor (altın kural 17: tek yerden okunur).
export async function buildYilZiyaretPortfoyRaporu(): Promise<YilZiyaretPortfoyPayload> {
  const board = await buildLiveBoard();
  const rows: YilZiyaretPortfoyRow[] = board.owners.map((o) => ({
    owner: o.owner,
    initials: o.initials,
    visitsYear: o.goals.visitsYear,
    portfolio: o.portfolio,
    coverage: {
      coveredCustomers: o.coverage.covered.actual,
      contactsPer: o.coverage.contactsPer,
      activitiesYear: o.coverage.activitiesYear,
    },
    inactive: o.inactive,
  }));
  return { generatedAt: new Date().toISOString(), rows };
}
