import 'server-only';
import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { ApiError } from '@/lib/http/api-error';
import { ownerOrderCompare } from './live-board-shared';
import {
  QUARTERLY_TARGET_CODES,
  QUARTER_INDEXES,
  TARGET_CODES,
  isTargetCode,
  isTargetOwnerName,
  normalizeTargetValue,
  quarterRange,
  type QuarterValues,
  type SaveTargetsInput,
  type TargetCode,
  type TargetsAdminPayload,
  type TargetsAdminUser,
} from './targets-shared';

// Hedefler (v2) — veri erişimi. Çağdaş Bey (10.09.2026): kişi bazlı hedefleri Admin /
// Super Admin ayrı ekrandan girer. Depo:
//   * haftalık aktivite  → allowed_users.weekly_target_total_activities (Kullanıcı Yönetimi
//     ile aynı kolon; kanal kırılımı orada kalır)
//   * yıl / çeyrek       → crm_target_values (scope 'user', period_type 'year' | 'quarter')
// Değer boş / 0 → kayıt silinir (hedef yok). Her kayıt crm_audit_events'e düşer
// (resource_type 'user_targets').

type Actor = { id: string; email: string };

// Hedef girilebilen kişiler: YALNIZ satış ekibi (Canlı Ekran OWNER_ORDER'da adı geçen aktif
// hesaplar) — `isTargetOwnerName`. Sorgu rol üzerinden daraltır, son söz OWNER_ORDER'ındır:
// ikincil rolü account_manager olan yönetici hesapları (genel müdür) listeye girmez.
const Q_USERS = `
  select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name, u.email,
         coalesce(u.weekly_target_total_activities, 0)::int as weekly_total
  from public.allowed_users u
  where u.is_active = true
    and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
  order by 2
`;

const Q_VALUES = `
  select tv.scope_user_id::text as user_id, td.code, tv.period_type, tv.period_start::text as period_start, tv.target_value::float8 as value
  from public.crm_target_values tv
  join public.crm_target_definitions td on td.id = tv.definition_id
  where tv.scope_type = 'user'
    and tv.period_type in ('year', 'quarter')
    and tv.period_start >= make_date($1::int, 1, 1) and tv.period_end <= make_date($1::int, 12, 31)
`;

function emptyQuarters(): QuarterValues {
  return [null, null, null, null];
}

export async function loadTargetsAdmin(year: number): Promise<TargetsAdminPayload> {
  const [userResult, valueResult] = await Promise.all([db.query(Q_USERS), db.query(Q_VALUES, [year])]);
  const users = new Map<string, TargetsAdminUser>();
  for (const row of userResult.rows as any[]) {
    users.set(String(row.id), {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      weeklyTotal: Number(row.weekly_total ?? 0),
      yearly: {},
      quarterly: {},
    });
  }
  for (const row of valueResult.rows as any[]) {
    const user = users.get(String(row.user_id));
    if (!user || !isTargetCode(row.code)) continue;
    const code: TargetCode = row.code;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (row.period_type === 'year') {
      user.yearly[code] = value;
    } else {
      const month = Number(String(row.period_start).slice(5, 7));
      const index = Math.ceil(month / 3) - 1;
      const values = user.quarterly[code] ?? emptyQuarters();
      values[index] = value;
      user.quarterly[code] = values;
    }
  }
  const list = Array.from(users.values())
    .filter((user) => isTargetOwnerName(user.name))
    .sort((a, b) => ownerOrderCompare(a.name, b.name));
  return {
    generatedAt: new Date().toISOString(),
    year,
    quarters: QUARTER_INDEXES.map((index) => quarterRange(year, index)),
    users: list,
  };
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function upsertValue(
  client: PoolClient,
  actor: Actor,
  definitionId: string,
  userId: string,
  periodType: 'year' | 'quarter',
  start: string,
  end: string,
  value: number | null,
) {
  if (value == null) {
    await client.query(
      `delete from public.crm_target_values
       where definition_id = $1 and scope_type = 'user' and scope_user_id = $2
         and period_type = $3 and period_start = $4::date and period_end = $5::date`,
      [definitionId, userId, periodType, start, end],
    );
    return;
  }
  await client.query(
    `insert into public.crm_target_values
       (definition_id, scope_type, scope_user_id, period_type, period_start, period_end, target_value, created_by, updated_by)
     values ($1, 'user', $2, $3, $4::date, $5::date, $6, $7, $7)
     on conflict (definition_id, scope_type, scope_user_id, period_type, period_start, period_end)
     do update set target_value = excluded.target_value, updated_by = excluded.updated_by, updated_at = now()`,
    [definitionId, userId, periodType, start, end, value, actor.id],
  );
}

/** Bir kişinin bir yılına ait tüm hedefleri tek transaction'da yazar; gönderilmeyen alanlara dokunmaz. */
export async function saveUserTargets(actor: Actor, input: SaveTargetsInput): Promise<TargetsAdminUser> {
  return withTransaction(async (client) => {
    const userRow = await client.query('select id::text as id from public.allowed_users where id = $1 and is_active = true', [input.userId]);
    if (!userRow.rows.length) throw new ApiError('NOT_FOUND', 'Kullanıcı bulunamadı.', 404);

    const definitions = await client.query('select id::text as id, code from public.crm_target_definitions where is_active = true');
    const definitionIdByCode = new Map<string, string>((definitions.rows as any[]).map((row) => [String(row.code), String(row.id)]));
    const missing = TARGET_CODES.filter((code) => !definitionIdByCode.has(code));
    if (missing.length) throw new ApiError('TARGET_DEFINITION_MISSING', `Hedef tanımı eksik (migration 026 uygulanmalı): ${missing.join(', ')}`, 409);

    const before = await snapshot(client, input.year, input.userId);

    if (input.weeklyTotal !== undefined) {
      const weekly = normalizeTargetValue(input.weeklyTotal) ?? 0;
      await client.query('update public.allowed_users set weekly_target_total_activities = $2 where id = $1', [input.userId, weekly]);
    }

    for (const [code, raw] of Object.entries(input.yearly ?? {})) {
      if (!isTargetCode(code)) continue;
      await upsertValue(client, actor, definitionIdByCode.get(code)!, input.userId, 'year', `${input.year}-01-01`, `${input.year}-12-31`, normalizeTargetValue(raw));
    }

    for (const [code, values] of Object.entries(input.quarterly ?? {})) {
      if (!isTargetCode(code) || !QUARTERLY_TARGET_CODES.includes(code) || !Array.isArray(values)) continue;
      for (const index of QUARTER_INDEXES) {
        const quarter = quarterRange(input.year, index);
        await upsertValue(client, actor, definitionIdByCode.get(code)!, input.userId, 'quarter', quarter.start, quarter.end, normalizeTargetValue(values[index - 1]));
      }
    }

    const after = await snapshot(client, input.year, input.userId);
    await recordAuditEvent({
      actorId: actor.id, actorEmail: actor.email,
      action: 'targets.user.updated', resourceType: 'user_targets', resourceId: input.userId,
      before, after, metadata: { year: input.year },
    }, client);
    return after;
  });
}

async function snapshot(client: PoolClient, year: number, userId: string): Promise<TargetsAdminUser> {
  const [userResult, valueResult] = await Promise.all([
    client.query(`select id::text as id, coalesce(nullif(trim(full_name), ''), email) as name, email, coalesce(weekly_target_total_activities, 0)::int as weekly_total from public.allowed_users where id = $1`, [userId]),
    client.query(`${Q_VALUES} and tv.scope_user_id = $2`, [year, userId]),
  ]);
  const row = userResult.rows[0] as any;
  const user: TargetsAdminUser = { id: String(row.id), name: String(row.name), email: String(row.email), weeklyTotal: Number(row.weekly_total ?? 0), yearly: {}, quarterly: {} };
  for (const value of valueResult.rows as any[]) {
    if (!isTargetCode(value.code)) continue;
    const code: TargetCode = value.code;
    if (value.period_type === 'year') user.yearly[code] = Number(value.value);
    else {
      const index = Math.ceil(Number(String(value.period_start).slice(5, 7)) / 3) - 1;
      const values = user.quarterly[code] ?? emptyQuarters();
      values[index] = Number(value.value);
      user.quarterly[code] = values;
    }
  }
  return user;
}
