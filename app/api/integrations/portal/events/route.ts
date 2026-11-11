import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPortalRequest } from '@/lib/integrations/portal-auth';
import { PORTAL_EVENT_TYPE_LABELS, portalEventNote } from '@/lib/integrations/portal-event-note';

export const dynamic = 'force-dynamic';

// PAX Portal olayı → İş ortağı sürecine "Entegrasyon Süreci" aktivitesi (kanıt).
// Olay aktivitesi fazı DEĞİŞTİRMEZ (affects_phase=false); yalnız faz yoksa süreç bir kez Faz 3'te başlatılır.
// Kanal ayrı kolon olmadığı için "Portal" bilgisi payload.channel ve created_by'da tutulur.
const AKSIYON = 'AKTIVITE:Entegrasyon Süreci';
const CREATED_BY = 'PAX Portal';
const PARTNER_SUBTYPE = 'Entegrasyon Firması';
const START_PHASE = 3;
const START_NOTE = "Portal bağlantısıyla entegrasyon süreci Faz 3'ten başlatıldı (Portal)";
type EventType = keyof typeof PORTAL_EVENT_TYPE_LABELS;

const EventSchema = z.object({
  eventId: z.guid(),
  type: z.enum(Object.keys(PORTAL_EVENT_TYPE_LABELS) as [EventType, ...EventType[]]),
  occurredAt: z.iso.datetime({ offset: true }),
  crmFirmId: z.guid(),
  productLine: z.enum(['A2A', 'D2D_DLL', 'D2D_JAR']).nullish(),
  version: z.string().trim().max(64).nullish(),
  title: z.string().trim().max(200).nullish(),
  userEmail: z.email().max(254).nullish(),
  backfill: z.boolean(),
});

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
    const firm = await client.query<{ integration_enabled: boolean | null; partner_active: boolean | null; phase_no: number | null }>(
      `select m.integration_enabled, r.is_active as partner_active, ps.active_phase_no as phase_no
         from public.musteriler m
         left join public.organization_roles r on r.customer_id = m.id and r.role_key = 'business_partner'
         left join public.organization_pipeline_states ps on ps.customer_id = m.id and ps.context_key = 'business_partner'
        where m.id = $1
        for update of m`,
      [event.crmFirmId],
    );
    if (!firm.rowCount) { await client.query('rollback'); return json({ message: 'firm_not_found' }, 404); }
    const { integration_enabled, partner_active, phase_no } = firm.rows[0];

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

    // Portal'a gelen firma iş ortağı sayılır: rol + entegrasyon yeteneği açılır.
    const partnerRoleOpened = !partner_active;
    if (partnerRoleOpened) {
      await client.query(
        `insert into public.organization_roles (customer_id, role_key, subtype, is_active)
         values ($1, 'business_partner', $2, true)
         on conflict (customer_id, role_key) do update
           set is_active = true, subtype = coalesce(public.organization_roles.subtype, excluded.subtype),
               version = public.organization_roles.version + 1, updated_at = now()`,
        [event.crmFirmId, PARTNER_SUBTYPE],
      );
    }
    const integrationEnabled = !integration_enabled;
    // DB kuralı (validate_activity_context_phase): Entegrasyon Süreci aktivitesi yalnız yeteneği açık firmada.
    if (integrationEnabled) {
      await client.query('update public.musteriler set integration_enabled = true where id = $1', [event.crmFirmId]);
    }
    // Faz yoksa (null/0) süreç Faz 3'ten başlar; sonrası ekip tarafından manuel ilerletilir.
    const phaseStarted = !phase_no;
    if (phaseStarted) {
      await client.query(
        `insert into public.pipeline_eventleri
           (musteri_id, faz_no, event_type, durum, aksiyon, aktivite_tarihi, notlar, payload,
            created_by, activity_scope, affects_phase, activity_context)
         values ($1, $2, 'note_added', 'Devam Ediyor', $3, ($4::timestamptz at time zone 'Europe/Istanbul')::date, $5, $6::jsonb,
            $7, 'account', true, 'business_partner')`,
        [
          event.crmFirmId, START_PHASE, AKSIYON, event.occurredAt, START_NOTE,
          JSON.stringify({ source: 'portal', channel: 'Portal', eventId: event.eventId, phaseStart: true }),
          CREATED_BY,
        ],
      );
    }
    const expectedPhase = phaseStarted ? START_PHASE : phase_no;

    const inserted = await client.query<{ id: string }>(
      `insert into public.pipeline_eventleri
         (musteri_id, faz_no, event_type, durum, aksiyon, aktivite_tarihi, notlar, payload,
          created_by, activity_scope, affects_phase, activity_context)
       values ($1, $2, 'note_added', 'Tamamlandı', $3, ($4::timestamptz at time zone 'Europe/Istanbul')::date, $5, $6::jsonb,
          $7, 'account', false, 'business_partner')
       returning id`,
      [
        event.crmFirmId, expectedPhase, AKSIYON, event.occurredAt, portalEventNote(event),
        JSON.stringify({
          source: 'portal', channel: 'Portal', eventId: event.eventId, type: event.type, occurredAt: event.occurredAt,
          productLine: event.productLine ?? null, version: event.version ?? null, title: event.title ?? null, userEmail: event.userEmail ?? null,
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
    if ((after.rows[0]?.phase_no ?? null) !== expectedPhase) {
      await client.query('rollback');
      return json({ message: 'phase_guard' }, 409);
    }

    await client.query('commit');
    return json({ pipelineEventId, partnerRoleOpened, integrationEnabled, phaseStarted }, 201);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('[portal/events]', error instanceof Error ? error.message : error);
    return json({ message: 'internal_error' }, 500);
  } finally {
    client.release();
  }
}
