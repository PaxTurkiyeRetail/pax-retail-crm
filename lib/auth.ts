import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from './db';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';
const AUTH_SESSION_TTL_HOURS = Number(process.env.AUTH_SESSION_TTL_HOURS ?? '24');

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: string | null;
};

export async function verifyUserCredentials(email: string, password: string): Promise<AuthUser | null> {
  const result = await db.query(
    `
      select id, email, password_hash, full_name, is_active, role
      from public.allowed_users
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );

  const user = result.rows[0];
  if (!user || !user.is_active || !user.password_hash) return null;

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    is_active: user.is_active,
    role: user.role,
  };
}

export function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function createSession(userId: string) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + AUTH_SESSION_TTL_HOURS);

  await db.query(
    `
      insert into public.user_sessions (user_id, session_token, expires_at)
      values ($1, $2, $3)
    `,
    [userId, sessionToken, expiresAt]
  );

  return { sessionToken, expiresAt };
}

export async function getSessionTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getUserBySessionToken(sessionToken: string): Promise<AuthUser | null> {
  const result = await db.query(
    `
      select u.id, u.email, u.full_name, u.is_active, u.role
      from public.user_sessions s
      inner join public.allowed_users u on u.id = s.user_id
      where s.session_token = $1
        and s.expires_at > now()
      limit 1
    `,
    [sessionToken]
  );

  const user = result.rows[0];
  if (!user || !user.is_active) return null;

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    is_active: user.is_active,
    role: user.role,
  };
}

export async function deleteSession(sessionToken: string) {
  await db.query('delete from public.user_sessions where session_token = $1', [sessionToken]);
}
