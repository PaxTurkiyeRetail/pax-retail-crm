// PERFORMANS KARNESİ — Hareket Dökümü paylaşımlı tipler (istemci + sunucu).

export const PERF_EVENT_TYPES = [
  { key: 'gorusme', label: 'Görüşme' },
  { key: 'aktivite', label: 'Diğer aktivite' },
  { key: 'teklif', label: 'Teklif gönderildi' },
  { key: 'kazanim', label: 'Kazanılan' },
  { key: 'kayip', label: 'Kaybedilen' },
  { key: 'fatura', label: 'Fatura' },
  { key: 'cevirme', label: 'Kategori değişimi' },
] as const;
export type PerfEventType = (typeof PERF_EVENT_TYPES)[number]['key'];

export type PerfEvent = {
  date: string;
  type: PerfEventType;
  owner: string;
  customerId: string | null;
  customer: string;
  detail: string;
  amount: number | null;
  devices: number | null;
};

export type PerfEventsPayload = {
  range: { from: string; to: string; label: string };
  owner: string | null;
  total: number;
  truncated: boolean;
  events: PerfEvent[];
};
