import 'server-only';
import { db } from '@/lib/db';
import { activityLabelFromRow } from '@/lib/activities/presentation';
import {
  activityTargetKind,
  addWeeklyCounters,
  emptyWeeklyCounters,
  endOfWeek,
  startOfWeek,
  toDateInput,
  type WeeklyTargetCounters,
} from '@/lib/reports/weekly-targets-shared';

export {
  WEEKLY_TARGET_LABELS,
  achievementPct,
  activityTargetKind,
  endOfWeek,
  startOfWeek,
  toDateInput,
} from '@/lib/reports/weekly-targets-shared';
export type { WeeklyTargetCounters, WeeklyTargetKind } from '@/lib/reports/weekly-targets-shared';

// Haftalık hedef / gerçekleşme verisi (Dashboard "Hedef" kartı).
//
// Neden ayrı uç: aynı sayılar haftalık yönetim sunumunda da hesaplanıyor ama o
// akış tüm sunum payload'ını (faz dağılımları, künye skorları, Jira, segment
// tabloları) kuruyor. Dashboard'da her açılışta bunu çalıştırmak gereksiz yük;
// burada yalnızca iki sorgu var: haftanın aktiviteleri + kullanıcı hedefleri.

export type WeeklyTargetRow = {
  owner: string;
  actual: WeeklyTargetCounters;
  target: WeeklyTargetCounters;
};

export type WeeklyTargetsPayload = {
  range: { from: string; to: string };
  rows: WeeklyTargetRow[];
  totals: { actual: WeeklyTargetCounters; target: WeeklyTargetCounters };
};

function targetsFromUserRow(row: any): WeeklyTargetCounters {
  return {
    salesPhysical: Number(row?.weekly_target_sales_physical ?? 0) || 0,
    salesOnline: Number(row?.weekly_target_sales_online ?? 0) || 0,
    salesPhone: Number(row?.weekly_target_sales_phone ?? 0) || 0,
    salesEmail: Number(row?.weekly_target_sales_email ?? 0) || 0,
    technicalPhysical: Number(row?.weekly_target_technical_physical ?? 0) || 0,
    technicalOnline: Number(row?.weekly_target_technical_online ?? 0) || 0,
    totalActivities: Number(row?.weekly_target_total_activities ?? 0) || 0,
    uniqueCustomers: Number(row?.weekly_target_unique_customers ?? 0) || 0,
  };
}

export async function buildWeeklyTargets(options?: {
  from?: string;
  to?: string;
  owner?: string;
  today?: Date;
}): Promise<WeeklyTargetsPayload> {
  const today = options?.today ?? new Date();
  const from = String(options?.from ?? '').trim() || toDateInput(startOfWeek(today));
  const to = String(options?.to ?? '').trim() || toDateInput(endOfWeek(today));
  const owner = String(options?.owner ?? '').trim();

  const [activityResult, userResult] = await Promise.all([
    db.query(
      `
        select pe.aksiyon, pe.durum, pe.created_by, pe.musteri_id::text as musteri_id
        from public.pipeline_eventleri pe
        where pe.created_at >= $1::date
          and pe.created_at < ($2::date + interval '1 day')
      `,
      [from, to],
    ),
    db.query(
      `
        select full_name, email,
               weekly_target_sales_physical, weekly_target_sales_online,
               weekly_target_sales_phone, weekly_target_sales_email,
               weekly_target_technical_physical, weekly_target_technical_online,
               weekly_target_total_activities, weekly_target_unique_customers
        from public.allowed_users
        where is_active = true
      `,
    ),
  ]);

  // Gerçekleşen: aktiviteyi GİREN kişiye göre sayılır (müşterinin sorumlusu
  // farklı olsa bile temas eden kişinin performansı ölçülür).
  const byOwner = new Map<string, { counters: WeeklyTargetCounters; customers: Set<string> }>();
  for (const row of activityResult.rows as any[]) {
    const ownerName = String(row.created_by ?? '').trim();
    if (!ownerName) continue;
    const kind = activityTargetKind(activityLabelFromRow(row));
    if (kind === 'other') continue;

    let bucket = byOwner.get(ownerName);
    if (!bucket) {
      bucket = { counters: emptyWeeklyCounters(), customers: new Set<string>() };
      byOwner.set(ownerName, bucket);
    }
    bucket.counters[kind] += 1;
    bucket.counters.totalActivities += 1;
    if (row.musteri_id) bucket.customers.add(String(row.musteri_id));
  }

  const targetByName = new Map<string, WeeklyTargetCounters>();
  for (const row of userResult.rows as any[]) {
    const name = String(row.full_name ?? row.email ?? '').trim();
    if (name) targetByName.set(name, targetsFromUserRow(row));
  }

  const names = Array.from(new Set([...byOwner.keys(), ...targetByName.keys()]))
    .filter((name) => !owner || name === owner);

  const rows: WeeklyTargetRow[] = names
    .map((name) => {
      const bucket = byOwner.get(name);
      const actual = bucket ? { ...bucket.counters, uniqueCustomers: bucket.customers.size } : emptyWeeklyCounters();
      return { owner: name, actual, target: targetByName.get(name) ?? emptyWeeklyCounters() };
    })
    // Hiç aktivitesi ve hiç hedefi olmayan kullanıcılar kartı şişirmesin.
    .filter((row) => row.actual.totalActivities > 0 || row.target.totalActivities > 0)
    .sort((a, b) => b.actual.totalActivities - a.actual.totalActivities || a.owner.localeCompare(b.owner, 'tr'));

  return {
    range: { from, to },
    rows,
    totals: {
      actual: rows.reduce((acc, row) => addWeeklyCounters(acc, row.actual), emptyWeeklyCounters()),
      target: rows.reduce((acc, row) => addWeeklyCounters(acc, row.target), emptyWeeklyCounters()),
    },
  };
}
