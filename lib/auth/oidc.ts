import 'server-only';
import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/http/api-error';
import { normalizeRole, type AllowedRole } from '@/lib/roles';
import { getSystemParameterBoolean } from '@/lib/system-parameters';

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

type OidcTransaction = {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  exp: number;
};

const ROLE_PRIORITY: Record<AllowedRole, number> = {
  user: 1,
  account_manager: 2,
  itsm: 3,
  admin: 4,
  super_admin: 5,
};

let discoveryPromise: Promise<Discovery> | null = null;

export async function assertOidcRuntimeEnabled() {
  const enabled = await getSystemParameterBoolean('system_oidc_enabled', false);
  if (!enabled) throw new ApiError('OIDC_DISABLED', 'Kurumsal giriş henüz etkinleştirilmedi.', 503);
}

function required(name: string) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new ApiError('OIDC_NOT_CONFIGURED', 'Kurumsal giriş henüz yapılandırılmamış.', 503);
  return value;
}

export function oidcConfig() {
  const issuer = required('OIDC_ISSUER').replace(/\/$/, '');
  const clientId = required('OIDC_CLIENT_ID');
  const stateSecret = required('OIDC_STATE_SECRET');
  if (stateSecret.length < 32) throw new ApiError('OIDC_INVALID_CONFIG', 'OIDC state secret en az 32 karakter olmalıdır.', 503);
  if (process.env.NODE_ENV === 'production' && !issuer.startsWith('https://')) {
    throw new ApiError('OIDC_INVALID_CONFIG', 'OIDC issuer HTTPS olmalıdır.', 503);
  }
  return { issuer, clientId, clientSecret: String(process.env.OIDC_CLIENT_SECRET ?? '').trim(), stateSecret };
}

async function discovery() {
  const config = oidcConfig();
  discoveryPromise ??= fetch(`${config.issuer}/.well-known/openid-configuration`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new ApiError('OIDC_DISCOVERY_FAILED', 'Kimlik sağlayıcı bilgileri alınamadı.', 503);
      return response.json() as Promise<Discovery>;
    })
    .then((document) => {
      if (!document.authorization_endpoint || !document.token_endpoint || !document.jwks_uri || document.issuer !== config.issuer) {
        throw new ApiError('OIDC_DISCOVERY_INVALID', 'Kimlik sağlayıcı yapılandırması geçersiz.', 503);
      }
      return document;
    });
  return discoveryPromise;
}

function base64url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function signature(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/crm';
  return value;
}

export function encodeOidcTransaction(transaction: OidcTransaction) {
  const payload = base64url(JSON.stringify(transaction));
  return `${payload}.${signature(payload, oidcConfig().stateSecret)}`;
}

export function decodeOidcTransaction(value: string | null | undefined): OidcTransaction {
  if (!value) throw new ApiError('OIDC_STATE_INVALID', 'Kurumsal giriş oturumu bulunamadı.', 400);
  const [payload, suppliedSignature] = value.split('.');
  if (!payload || !suppliedSignature) throw new ApiError('OIDC_STATE_INVALID', 'Kurumsal giriş oturumu geçersiz.', 400);
  const expected = signature(payload, oidcConfig().stateSecret);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new ApiError('OIDC_STATE_INVALID', 'Kurumsal giriş oturumu doğrulanamadı.', 400);
  }
  const transaction = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OidcTransaction;
  if (!transaction.exp || transaction.exp < Date.now()) throw new ApiError('OIDC_STATE_EXPIRED', 'Kurumsal giriş oturumu sona erdi.', 400);
  transaction.next = safeNext(transaction.next);
  return transaction;
}

export async function createAuthorizationRequest(origin: string, next: string | null) {
  const config = oidcConfig();
  const document = await discovery();
  const state = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = `${origin}/auth/callback`;
  const url = new URL(document.authorization_endpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid profile email groups');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return {
    url,
    transaction: encodeOidcTransaction({ state, nonce, verifier, next: safeNext(next), exp: Date.now() + 10 * 60_000 }),
  };
}

export async function redeemAuthorizationCode(args: { code: string; state: string; transactionCookie: string; origin: string }) {
  const transaction = decodeOidcTransaction(args.transactionCookie);
  if (transaction.state !== args.state) throw new ApiError('OIDC_STATE_MISMATCH', 'Kurumsal giriş doğrulaması başarısız.', 400);
  const config = oidcConfig();
  const document = await discovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: args.code,
    redirect_uri: `${args.origin}/auth/callback`,
    code_verifier: transaction.verifier,
  });
  if (config.clientSecret) body.set('client_secret', config.clientSecret);
  const tokenResponse = await fetch(document.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
  });
  const tokens = await tokenResponse.json() as { id_token?: string; error?: string };
  if (!tokenResponse.ok || !tokens.id_token) throw new ApiError('OIDC_TOKEN_EXCHANGE_FAILED', 'Kurumsal giriş tamamlanamadı.', 401);
  const verified = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(document.jwks_uri)), {
    issuer: config.issuer,
    audience: config.clientId,
  });
  if (verified.payload.nonce !== transaction.nonce) throw new ApiError('OIDC_NONCE_MISMATCH', 'Kurumsal giriş doğrulaması başarısız.', 401);
  return { claims: verified.payload, next: transaction.next };
}

function claimString(claims: JWTPayload, ...names: string[]) {
  for (const name of names) {
    const value = claims[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function resolveEnterpriseUser(claims: JWTPayload) {
  await assertOidcRuntimeEnabled();
  const subject = claims.sub;
  const tenantId = claimString(claims, 'tid', 'tenant_id');
  const email = claimString(claims, 'preferred_username', 'email', 'upn')?.toLowerCase();
  if (!subject || !tenantId || !email) throw new ApiError('OIDC_CLAIMS_INVALID', 'Kimlik sağlayıcı gerekli hesap bilgilerini göndermedi.', 403);

  const client = await db.connect();
  try {
    await client.query('begin');
    let result = await client.query(
      `select au.id, au.email, au.full_name, au.role, au.is_active
       from public.auth_identities ai join public.allowed_users au on au.id = ai.user_id
       where ai.provider = 'active_directory' and ai.tenant_id = $1 and ai.subject = $2 limit 1 for update of ai`,
      [tenantId, subject],
    );
    if (!result.rowCount) {
      result = await client.query(
        `select id, email, full_name, role, is_active from public.allowed_users
         where lower(email) = lower($1) limit 1 for update`,
        [email],
      );
      const candidate = result.rows[0];
      if (!candidate?.is_active) throw new ApiError('OIDC_USER_NOT_PROVISIONED', 'Hesabınız CRM için yetkilendirilmemiş.', 403);
      await client.query(
        `insert into public.auth_identities(provider, tenant_id, subject, user_id, email_at_link_time, last_login_at)
         values ('active_directory',$1,$2,$3,$4,now())`,
        [tenantId, subject, candidate.id, email],
      );
    } else {
      await client.query(
        `update public.auth_identities set last_login_at = now()
         where provider = 'active_directory' and tenant_id = $1 and subject = $2`,
        [tenantId, subject],
      );
    }

    const user = result.rows[0];
    if (!user?.is_active) throw new ApiError('OIDC_USER_DISABLED', 'CRM hesabınız devre dışı.', 403);
    const groups = Array.isArray(claims.groups) ? claims.groups.filter((value): value is string => typeof value === 'string') : [];
    const groupRoleSyncEnabled = process.env.OIDC_SYNC_GROUP_ROLES === 'true'
      && await getSystemParameterBoolean('system_oidc_group_role_sync_enabled', false);
    if (groupRoleSyncEnabled) {
      if (claims._claim_names && typeof claims._claim_names === 'object' && 'groups' in claims._claim_names) {
        throw new ApiError('OIDC_GROUP_OVERAGE', 'Kullanıcının AD grup listesi token sınırını aşıyor; grup senkronizasyonu yapılandırılmalıdır.', 403);
      }
      const mappings = await client.query(
        `select role from public.auth_group_role_mappings
         where tenant_id = $1 and is_active = true and group_id = any($2::text[])`,
        [tenantId, groups],
      );
      const mappedRole = mappings.rows
        .map((row) => normalizeRole(row.role))
        .filter((role): role is AllowedRole => Boolean(role))
        .sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0] ?? 'user';
      if (mappedRole !== normalizeRole(user.role)) {
        await client.query('update public.allowed_users set role = $1 where id = $2', [mappedRole, user.id]);
        user.role = mappedRole;
      }
    }
    await client.query('commit');
    return { id: String(user.id), email: String(user.email), fullName: user.full_name ? String(user.full_name) : null, role: normalizeRole(user.role) };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
