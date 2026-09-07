type UserIdentity = { id: string; email: string; full_name: string | null };

export type OwnedResource = {
  owner_user_id?: string | null;
  owner_email?: string | null;
  owner_name?: string | null;
  sorumlu?: string | null;
};

function normalizeIdentity(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

export function isResourceOwner(user: UserIdentity, resource: OwnedResource): boolean {
  // A canonical owner must never be overridden by a matching legacy display name.
  if (resource.owner_user_id) return String(resource.owner_user_id) === user.id;
  const ownerEmail = normalizeIdentity(resource.owner_email);
  if (ownerEmail) return ownerEmail === normalizeIdentity(user.email);
  const ownerName = normalizeIdentity(resource.owner_name ?? resource.sorumlu);
  return Boolean(ownerName && user.full_name && ownerName === normalizeIdentity(user.full_name));
}
