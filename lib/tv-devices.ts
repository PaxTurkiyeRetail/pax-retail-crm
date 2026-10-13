import crypto from 'crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { hashOpaqueToken } from './auth';

// TV cihaz oturumu: kullanıcı oturumundan tamamen ayrı, yalnız Canlı Ekran verisini okur.
export const TV_COOKIE_NAME = 'crm_tv';
export const TV_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const PAIR_CODE_TTL_MS = 5 * 60 * 1000;
// Karışan karakterler yok (0/O, 1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type TvDevice = {
  id: string;
  name: string;
  approved_at: string | null;
  approved_by: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  created_at: string;
};

function newPairCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function newDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function getTvTokenFromCookies() {
  return (await cookies()).get(TV_COOKIE_NAME)?.value ?? null;
}

type DeviceRow = TvDevice & { pair_code: string | null; pair_code_expires_at: string | null };

export async function findDeviceByToken(token: string): Promise<DeviceRow | null> {
  const result = await db.query<DeviceRow>(
    `select id, name, pair_code, pair_code_expires_at, approved_at, approved_by, revoked_at, last_seen_at, last_ip, created_at
       from public.tv_devices where token_hash = $1`,
    [hashOpaqueToken(token)],
  );
  return result.rows[0] ?? null;
}

/** Bekleyen cihaz için yeni kod; cihaz yoksa oluşturur. Onaylı/iptal cihazın kodu yenilenmez. */
export async function startPairing(token: string, meta: { ip: string | null; userAgent: string | null }) {
  const code = newPairCode();
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MS);
  const existing = await findDeviceByToken(token);
  if (existing) {
    if (existing.approved_at || existing.revoked_at) return { device: existing, code: null, expiresAt: null };
    await db.query(
      `update public.tv_devices set pair_code = $2, pair_code_expires_at = $3, last_ip = $4, user_agent = $5 where id = $1`,
      [existing.id, code, expiresAt, meta.ip, meta.userAgent],
    );
    return { device: existing, code, expiresAt };
  }
  const inserted = await db.query<DeviceRow>(
    `insert into public.tv_devices (token_hash, pair_code, pair_code_expires_at, last_ip, user_agent)
     values ($1, $2, $3, $4, $5)
     returning id, name, pair_code, pair_code_expires_at, approved_at, approved_by, revoked_at, last_seen_at, last_ip, created_at`,
    [hashOpaqueToken(token), code, expiresAt, meta.ip, meta.userAgent],
  );
  return { device: inserted.rows[0], code, expiresAt };
}

export async function approvePairCode(code: string, name: string, approvedBy: string) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const result = await db.query<{ id: string }>(
    `update public.tv_devices
        set approved_at = now(), approved_by = $3, name = $2, pair_code = null, pair_code_expires_at = null
      where pair_code = $1 and pair_code_expires_at > now() and approved_at is null and revoked_at is null
      returning id`,
    [normalized, name.trim() || 'TV', approvedBy],
  );
  return result.rows[0]?.id ?? null;
}

export async function revokeDevice(id: string, revokedBy: string) {
  const result = await db.query(
    `update public.tv_devices set revoked_at = now(), revoked_by = $2, pair_code = null where id = $1 and revoked_at is null`,
    [id, revokedBy],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listDevices(): Promise<TvDevice[]> {
  const result = await db.query<TvDevice>(
    `select id, name, approved_at, approved_by, revoked_at, last_seen_at, last_ip, created_at
       from public.tv_devices where approved_at is not null
      order by revoked_at nulls first, created_at desc`,
  );
  return result.rows;
}

/** Cookie'deki cihaz onaylı ve iptal edilmemiş mi? Son görülme güncellenir. */
export async function getActiveTvDevice(): Promise<DeviceRow | null> {
  const token = await getTvTokenFromCookies();
  if (!token) return null;
  const device = await findDeviceByToken(token);
  if (!device || !device.approved_at || device.revoked_at) return null;
  await db.query(`update public.tv_devices set last_seen_at = now() where id = $1`, [device.id]);
  return device;
}
