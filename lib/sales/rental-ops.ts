// Kiralama operasyon durumu (migration 045, crm_sales.rental_ops_status). Tek tanım: API, ekran, rapor.
export const RENTAL_OPS_STATUSES = [
  { value: 'hazirlik', label: 'Hazırlık' },
  { value: 'sim_bekliyor', label: 'SIM bekliyor' },
  { value: 'sozlesme_bekliyor', label: 'Sözleşme bekliyor' },
  { value: 'kurulum', label: 'Kurulum' },
  { value: 'aktif', label: 'Aktif' },
  { value: 'iptal', label: 'İptal' },
] as const;

export type RentalOpsStatus = (typeof RENTAL_OPS_STATUSES)[number]['value'];

/** Boş durum = hazırlık (eski kayıtlar için veri uydurulmaz, ekranda varsayılan gösterilir). */
export const DEFAULT_RENTAL_OPS_STATUS: RentalOpsStatus = 'hazirlik';

export function isRentalOpsStatus(value: unknown): value is RentalOpsStatus {
  return RENTAL_OPS_STATUSES.some((s) => s.value === value);
}

export function rentalOpsLabel(value: unknown) {
  return RENTAL_OPS_STATUSES.find((s) => s.value === value)?.label ?? 'Hazırlık';
}
