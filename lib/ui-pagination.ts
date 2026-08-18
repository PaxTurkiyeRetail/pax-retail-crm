export const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;

export function normalizePageSize(value: unknown, fallback = 25) {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : fallback;
}
