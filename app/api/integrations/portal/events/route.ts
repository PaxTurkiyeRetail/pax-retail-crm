import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPortalRequest } from '@/lib/integrations/portal-auth';

export const dynamic = 'force-dynamic';

// PAX Portal olayı → İş ortağı sürecine "Entegrasyon Süreci" aktivitesi (kanıt).
// Faz DEĞİŞMEZ: affects_phase=false, faz_no = firmanın o anki iş ortağı fazı.
// Kanal ayrı kolon olmadığı için "Portal" bilgisi payload.channel ve created_by'da tutulur.
const AKSIYON = 'AKTIVITE:Entegrasyon Süreci';
const CREATED_BY = 'PAX Portal';
const BACKFILL_PREFIX = '[Portal geçmiş aktarımı] ';

const TYPE_LABELS = {
  'partner.registered': 'Portal kaydı oluşturuldu',
  'partner.profile_completed': 'Portal profili tamamlandı',
  'partner.line_granted': 'Ürün hattı erişimi verildi',
  'partner.line_revoked': 'Ürün hattı erişimi kaldırıldı',
  'partner.artifact_downloaded': 'SDK/paket indirildi',
} as const;
const LINE_LABELS = { A2A: 'A2A', D2D_DLL: 'D2D-DLL', D2D_JAR: 'D2D-JAR' } as const;

const EventSchema = z.object({
  eventId: z.guid(),
  type: z.enum(Object.keys(TYPE_LABELS) as [keyof typeof TYPE_LABELS, ...(keyof typeof TYPE_LABELS)[]]),
  occurredAt: z.iso.datetime({ offset: true }),
  crmFirmId: z.guid(),
  productLine: z.enum(['A2A', 'D2D_DLL', 'D2D_JAR']).nullish(),
  version: z.string().trim().max(64).nullish(),
  userEmail: z.email().max(254).nullish(),
  backfill: z.boolean(),
});
export type PortalEvent = z.infer<typeof EventSchema>;

export function portalEventNote(event: PortalEvent) {
  const parts: string[] = [TYPE_LABELS[event.type]];
  if (event.productLine) parts.push(LINE_LABELS[event.productLine]);
  if (event.version) parts.push(`sürüm ${event.version}`);
  return `${event.backfill ? BACKFILL_PREFIX : ''}${parts.join(' · ')} (Portal)`;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = verifyPortalRequest(request, undefined, undefined, rawBody);
  if (!auth.ok) return json({ message: auth.status === 503 ? 'unavailable' : 'unauthorized' }, auth.status);

  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return json({ message: 'invalid_json' }, 400); }
  const result = EventSchema.safeParse(parsed);
  if (!result.success) return json({ message: 'invalid_event', fields: result.error.issues.map((i) => i.path.join('.')) }, 400);
  const event = result.data;

  const client = await db.connect();
  try {
    await client.query('begin');
    // Firma kilitlenir: aynı firmaya eşzamanlı olaylarda faz kontrolü tutarlı kalır.
    const firm = await client.query<{ integration_enabled: boolean; phase_no: number | null }>(
      `select m.integration_enabled, ps.active_phase_no as phase_no
         from public.musteriler m
         join public.organization_roles r on r.customer_id = m.id and r.role_key = 'business_partner' and r.is_active
         left join public.organization_pipeline_states ps on ps.customer_id = m.id and ps.context_key = 'business_partner'
        where m.id = $1
        for update of m`,
      [event.crmFirmId],
    );
    if (!firm.rowCount) { await client.query('rollback'); return json({ message: 'firm_not_found' }, 404); }
    const { integration_enabled, phase_no } = firm.rows[0];
    // DB kuralı (validate_activity_context_phase): Entegrasyon Süreci aktivitesi yalnız yeteneği açık firmada.
    if (!integration_enabled) { await client.query('rollback'); return json({ message: 'integration_disabled' }, 422); }

    const receipt = await client.query(
      `insert into public.portal_event_receipts (event_id, crm_firm_id, event_type, occurred_at, backfill)
       values ($1, $2, $3, $4, $5)
       on conflict (event_id) do nothing
       returning event_id`,
      [event.eventId, event.crmFirmId, event.type, event.occurredAt, event.backfill],
    );
    if (!receipt.rowCount) {
      await client.query('rollback');
      return json({ duplicate: true }, 200);
    }

    const inserted = await client.query<{ id: string }>(
      `insert into public.pipeline_eventleri
         (musteri_id, faz_no, event_type, durum, aksiyon, aktivite_tarihi, notlar, payload,
          created_by, activity_scope, affects_phase, activity_context)
       values ($1, $2, 'note_added', 'Tamamlandı', $3, ($4::timestamptz at time zone 'Europe/Istanbul')::date, $5, $6::jsonb,
          $7, 'account', false, 'business_partner')
       returning id`,
      [
        event.crmFirmId, phase_no, AKSIYON, event.occurredAt, portalEventNote(event),
        JSON.stringify({
          source: 'portal', channel: 'Portal', eventId: event.eventId, type: event.type, occurredAt: event.occurredAt,
          productLine: event.productLine ?? null, version: event.version ?? null, userEmail: event.userEmail ?? null,
          backfill: event.backfill,
        }),
        CREATED_BY,
      ],
    );
    const pipelineEventId = inserted.rows[0].id;
    await client.query('update public.portal_event_receipts set pipeline_event_id = $2 where event_id = $1', [event.eventId, pipelineEventId]);

    // Güvence: sync trigger'ları fazı değiştirdiyse hiçbir şey yazılmaz.
    const after = await client.query<{ phase_no: number | null }>(
      `select active_phase_no as phase_no from public.organization_pipeline_states
        where customer_id = $1 and context_key = 'business_partner'`,
      [event.crmFirmId],
    );
    if ((after.rows[0]?.phase_no ?? null) !== phase_no) {
      await client.query('rollback');
      return json({ message: 'phase_guard' }, 409);
    }

    await client.query('commit');
    return json({ pipelineEventId }, 201);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('[portal/events]', error instanceof Error ? error.message : error);
    return json({ message: 'internal_error' }, 500);
  } finally {
    client.release();
  }
}
