import type { PgClient } from '@/lib/pg/client';

export function chunkArray<T>(items: T[], chunkSize = 500): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> | { data: T[] | null; error: { message: string } | null },
  batchSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += batchSize) {
    const to = from + batchSize - 1;
    const result = await buildQuery(from, to);
    if (result.error) throw new Error(result.error.message);
    const chunk = result.data ?? [];
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
  }
  return rows;
}

export async function fetchAllByCustomerIds<T>(
  client: PgClient,
  table: string,
  select: string,
  customerIds: string[],
  configure?: (query: any) => any,
  options?: { idChunkSize?: number; batchSize?: number; idColumn?: string },
): Promise<T[]> {
  const idChunkSize = options?.idChunkSize ?? 200;
  const batchSize = options?.batchSize ?? 1000;
  const idColumn = String(options?.idColumn ?? 'musteri_id').trim() || 'musteri_id';
  const rows: T[] = [];

  for (const idChunk of chunkArray(customerIds.filter(Boolean), idChunkSize)) {
    const chunkRows = await fetchAllRows<T>(async (from, to) => {
      let query = client.from(table).select(select).in(idColumn, idChunk).range(from, to);
      if (configure) query = configure(query);
      return await query;
    }, batchSize);
    rows.push(...chunkRows);
  }

  return rows;
}

export function formatIstanbulDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function inclusiveDayCount(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 1;
  const diff = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000);
  return Math.max(diff + 1, 1);
}
