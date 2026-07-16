export const TECHNICAL_PARAMETER_OWNERS = ['taha bitim', 'omer canatar', 'ömer canatar'];

export function normalizePersonKey(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9@._\s-]+/g, '')
    .replace(/\s+/g, ' ');
}

export function canManageSystemParameters(identity: { full_name?: string | null; fullName?: string | null; email?: string | null } | null | undefined) {
  const fullName = normalizePersonKey(identity?.full_name ?? identity?.fullName ?? '');
  const email = normalizePersonKey(identity?.email ?? '');
  const ownerNames = TECHNICAL_PARAMETER_OWNERS.map(normalizePersonKey);
  return ownerNames.some((owner) => fullName === owner || email.startsWith(owner.replace(/\s+/g, '.')) || email.startsWith(owner.replace(/\s+/g, '')));
}
