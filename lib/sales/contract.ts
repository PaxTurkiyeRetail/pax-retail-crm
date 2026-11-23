// Satış sözleşmesi / faturalama alanları (migration 054).
// Fatura başlangıcı boşsa raporlar satış tarihini kullanır (crm_sales_billing_v).

export type ContractFields = {
  billing_start_date: string | null;
  contract_no: string | null;
  contract_months: number | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Gövdeden gelen sözleşme alanlarını doğrular. Gönderilmeyen alan `current` değerini korur.
 * Hata varsa `{ error }` döner.
 */
export function parseContractFields(
  body: Record<string, unknown>,
  current: Partial<ContractFields> = {},
): { value: ContractFields } | { error: string } {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  let billing = current.billing_start_date ?? null;
  if (has('billing_start_date')) {
    const raw = String(body.billing_start_date ?? '').trim().slice(0, 10);
    if (raw && !ISO.test(raw)) return { error: 'Fatura başlangıç tarihi geçersiz.' };
    billing = raw || null;
  }

  let contractNo = current.contract_no ?? null;
  if (has('contract_no')) contractNo = String(body.contract_no ?? '').trim().slice(0, 80) || null;

  let months = current.contract_months ?? null;
  if (has('contract_months')) {
    const raw = body.contract_months;
    if (raw == null || String(raw).trim() === '') months = null;
    else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 240) return { error: 'Sözleşme süresi 1-240 ay arasında olmalı.' };
      months = n;
    }
  }

  return { value: { billing_start_date: billing, contract_no: contractNo, contract_months: months } };
}

/** Fatura başlangıcı (yoksa satış tarihi) + süre → sözleşme bitişi (son gün). */
export function contractEndDate(billingOrSaleDate: string | null, months: number | null): string | null {
  if (!billingOrSaleDate || !ISO.test(billingOrSaleDate) || !months) return null;
  const [y, m, d] = billingOrSaleDate.split('-').map(Number);
  // Postgres `date + interval 'n months'` ile aynı: ay sonu taşarsa ayın son gününe kırpılır.
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}
