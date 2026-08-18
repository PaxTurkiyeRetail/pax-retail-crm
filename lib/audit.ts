import 'server-only';
import type { PoolClient } from 'pg';
import { db } from '@/lib/db';

export type AuditEvent = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

type Queryable = Pick<PoolClient, 'query'>;

export async function recordAuditEvent(event: AuditEvent, client: Queryable = db) {
  await client.query(
    `
      insert into public.crm_audit_events (
        actor_id, actor_email, action, resource_type, resource_id,
        before_state, after_state, metadata
      ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
    `,
    [
      event.actorId ?? null,
      event.actorEmail ?? null,
      event.action,
      event.resourceType,
      event.resourceId ?? null,
      JSON.stringify(event.before ?? null),
      JSON.stringify(event.after ?? null),
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

export async function tryRecordAuditEvent(event: AuditEvent) {
  try {
    await recordAuditEvent(event);
  } catch (error) {
    const candidate = error as { code?: string } | null;
    if (candidate?.code !== '42P01') console.error('audit_write_failed', { action: event.action, error });
  }
}
