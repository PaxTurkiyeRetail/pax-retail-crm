import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from './db';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'crm_session';
const AUTH_SESSION_TTL_HOURS = Math.min(168, Math.max(1, Number(process.env.AUTH_SESSION_TTL_HOURS ?? '12')));

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: string | null;
};

type TokenHashSupport = { sessions: boolean; passwordResets: boolean };
let tokenHashSupportPromise: Promise<TokenHashSupport> | null = null;

export function hashOpaqueToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function getTokenHashSupport(): Promise<TokenHashSupport> {
  tokenHashSupportPromise ??= db.query<{ table_name: string; column_name: string }>(
    `
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'user_sessions' and column_name = 'session_token_hash') or
          (table_name = 'password_reset_tokens' and column_name = 'token_hash')
        )
    `,
  ).then((result) => ({
    sessions: result.rows.some((row) => row.table_name === 'user_sessions' && row.column_name === 'session_token_hash'),
    passwordResets: result.rows.some((row) => row.table_name === 'password_reset_tokens' && row.column_name === 'token_hash'),
  }));
  return tokenHashSupportPromise;
}

export async function verifyUserCredentials(email: string, password: string): Promise<AuthUser | null> {
  const result = await db.query(
    `
      select id, email, password_hash, full_name, is_active, role
      from public.allowed_users
      where lower(email) = lower($1)
      limit 1
    `,
    [email],
  );

  const user = result.rows[0];
  if (!user || !user.is_active || !user.password_hash) return null;

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  return {
    id: String(user.id),
    email: String(user.email),
    full_name: user.full_name ? String(user.full_name) : null,
    is_active: Boolean(user.is_active),
    role: user.role ? String(user.role) : null,
  };
}

export function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function createSession(userId: string) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000);
  const support = await getTokenHashSupport();

  if (support.sessions) {
    await db.query(
      `insert into public.user_sessions (user_id, session_token_hash, expires_at) values ($1, $2, $3)`,
      [userId, hashOpaqueToken(sessionToken), expiresAt],
    );
  } else {
    await db.query(
      `insert into public.user_sessions (user_id, session_token, expires_at) values ($1, $2, $3)`,
      [userId, sessionToken, expiresAt],
    );
  }

  return { sessionToken, expiresAt };
}

export async function getSessionTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getUserBySessionToken(sessionToken: string): Promise<AuthUser | null> {
  const support = await getTokenHashSupport();
  const result = support.sessions
    ? await db.query(
      `
        select u.id, u.email, u.full_name, u.is_active, u.role
        from public.user_sessions s
        inner join public.allowed_users u on u.id = s.user_id
        where s.session_token_hash = $1 and s.expires_at > now()
        limit 1
      `,
      [hashOpaqueToken(sessionToken)],
    )
    : await db.query(
      `
        select u.id, u.email, u.full_name, u.is_active, u.role
        from public.user_sessions s
        inner join public.allowed_users u on u.id = s.user_id
        where s.session_token = $1 and s.expires_at > now()
        limit 1
      `,
      [sessionToken],
    );

  const user = result.rows[0];
  if (!user || !user.is_active) return null;

  return {
    id: String(user.id),
    email: String(user.email),
    full_name: user.full_name ? String(user.full_name) : null,
    is_active: Boolean(user.is_active),
    role: user.role ? String(user.role) : null,
  };
}

export async function deleteSession(sessionToken: string) {
  const support = await getTokenHashSupport();
  if (support.sessions) {
    await db.query('delete from public.user_sessions where session_token_hash = $1', [hashOpaqueToken(sessionToken)]);
    return;
  }
  await db.query('delete from public.user_sessions where session_token = $1', [sessionToken]);
}
