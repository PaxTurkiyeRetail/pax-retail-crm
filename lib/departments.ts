// Departman (iş kolu) tek kaynak. musteriler.is_kolu ile aynı değerler.
// Kullanıcı departmanı allowed_users.departments (text[]); boş = tüm departmanlar.

export const DEPARTMENTS = ['Retail', 'Bank', 'Vertical'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  Retail: 'Retail',
  Bank: 'Bank',
  Vertical: 'Vertical',
};

/** Ekran → sabit departman. Listede olmayan ekranlar kullanıcı departmanına göre süzülür. */
export const SCREEN_DEPARTMENTS: Record<string, Department> = {
  'retail-operasyon': 'Retail',
};

export function isDepartment(value: unknown): value is Department {
  return typeof value === 'string' && (DEPARTMENTS as readonly string[]).includes(value);
}

export function normalizeDepartments(value: unknown): Department[] {
  const arr = Array.isArray(value) ? value : [];
  return DEPARTMENTS.filter((d) => arr.some((v) => String(v).trim().toLowerCase() === d.toLowerCase()));
}

/**
 * İstenen departman filtresini kullanıcının izinleriyle uzlaştırır.
 * allowed=null → kısıtsız (requested aynen; geçersizse null=Tümü).
 * allowed dolu → requested izinliyse o; değilse tek izin varsa o; çoklu izinde null + allowed listesi ile süz.
 * Dönüş: SQL'de kullanılacak departman listesi (null = filtre yok).
 */
export function resolveDepartmentFilter(requested: unknown, allowed: Department[] | null): Department[] | null {
  const req = typeof requested === 'string'
    ? DEPARTMENTS.find((d) => d.toLowerCase() === requested.trim().toLowerCase()) ?? null
    : null;
  if (!allowed || !allowed.length) return req ? [req] : null;
  if (req && allowed.includes(req)) return [req];
  return [...allowed];
}
