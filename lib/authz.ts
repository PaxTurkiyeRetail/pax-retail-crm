import 'server-only';
import { cache } from 'react';
import { getSessionTokenFromCookies, getUserBySessionToken } from '@/lib/auth';
import {
  canViewCRM,
  canViewReports,
  canViewUsers,
  isAdminLike,
  normalizeRole,
} from '@/lib/roles';
import { db } from '@/lib/db';

export type AllowedUser = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
};

const getAllowedUserOrThrowBase = cache(async (): Promise<AllowedUser> => {
  const sessionToken = await getSessionTokenFromCookies();
  if (!sessionToken) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
  }

  const user = await getUserBySessionToken(sessionToken);
  if (!user?.email) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
  }

  const result = await db.query(
    `
      select *
      from allowed_users
      where lower(email) = lower($1)
      limit 1
    `,
    [user.email]
  );

  const allowed = result.rows[0];
  if (!allowed || !allowed.is_active) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  }

  return {
    id: allowed.user_id ?? allowed.id ?? allowed.email,
    email: allowed.email,
    role: normalizeRole(allowed.role) ?? 'user',
    full_name: allowed.full_name,
  };
});

export async function getSessionEmailOrNull(): Promise<string | null> {
  try {
    const user = await getAllowedUserOrThrowBase();
    return user.email;
  } catch {
    return null;
  }
}

export async function requireAllowedUserOrThrow() {
  return getAllowedUserOrThrowBase();
}

export async function requireAdminOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!isAdminLike(allowed.role)) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  }
  return allowed;
}

export async function requireCrmAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!canViewCRM(allowed.role)) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  }
  return allowed;
}

export async function requireReportsAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!canViewReports(allowed.role)) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  }
  return allowed;
}

export async function requireUsersAccessOrThrow() {
  const allowed = await getAllowedUserOrThrowBase();
  if (!canViewUsers(allowed.role)) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
  }
  return allowed;
}

export { isAdminLike } from '@/lib/roles';
