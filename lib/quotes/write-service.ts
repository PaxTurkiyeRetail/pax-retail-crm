import 'server-only';
import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import type { ResolvedQuoteLine } from '@/lib/quotes/service';

type QuoteTotals = {
  totalDeviceCount: number;
  totalAmount: number;
  monthlyAmount: number;
  hardwareAmount: number;
};

type QuoteDates = {
  proposalDate: string;
  validUntil: string;
  followUpDate: string;
};

async function insertQuoteItems(client: PoolClient, quoteId: string, items: ResolvedQuoteLine[]) {
  for (const [index, item] of items.entries()) {
    await client.query(
      `
        insert into quote_items (
          quote_id, line_no, product_id, product_code_snapshot, product_name_snapshot,
          product_type, category, is_recurring, billing_period, quantity, unit_price,
          total_price, rule_min_qty, rule_max_qty
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `,
      [
        quoteId,
        index + 1,
        item.product_id,
        item.product_code,
        item.product_name,
        item.product_type,
        item.category,
        item.is_recurring,
        item.billing_period,
        item.quantity,
        item.unit_price,
        item.total_price,
        item.pricing_rule.min_qty,
        item.pricing_rule.max_qty,
      ],
    );
  }
}

async function runInTransaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createQuoteTransaction(args: {
  customerId: string;
  opportunityTitle: string | null;
  probability: number;
  note: string | null;
  status: 'draft' | 'sent';
  ownerName: string;
  ownerEmail: string;
  ownerUserId?: string | null;
  dates: QuoteDates;
  totals: QuoteTotals;
  items: ResolvedQuoteLine[];
  summaryText: string;
}) {
  return runInTransaction(async (client) => {
    const year = Number(args.dates.proposalDate.slice(0, 4));

    // Aynı yıl için numara üretimini transaction boyunca tekilleştirir.
    await client.query('select pg_advisory_xact_lock($1, $2)', [0x51554f54, year]);
    const serialResult = await client.query<{ next_serial: number }>(
      'select coalesce(max(quote_serial), 0)::integer + 1 as next_serial from quotes where quote_year = $1',
      [year],
    );
    const serial = Number(serialResult.rows[0]?.next_serial ?? 1);
    const quoteNo = `Q-${year}-${String(serial).padStart(3, '0')}`;

    const quoteResult = await client.query<{ id: string; quote_no: string; status: string }>(
      `
        insert into quotes (
          customer_id, opportunity_title, proposal_date, valid_until, follow_up_date,
          owner_name, owner_email, probability, status, closed_reason, total_device_count,
          total_amount, monthly_amount, hardware_amount, note, quote_year, quote_serial, quote_no
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,null,$10,$11,$12,$13,$14,$15,$16,$17)
        returning id, quote_no, status
      `,
      [
        args.customerId,
        args.opportunityTitle,
        args.dates.proposalDate,
        args.dates.validUntil,
        args.dates.followUpDate,
        args.ownerName,
        args.ownerEmail,
        args.probability,
        args.status,
        args.totals.totalDeviceCount,
        args.totals.totalAmount,
        args.totals.monthlyAmount,
        args.totals.hardwareAmount,
        args.note,
        year,
        serial,
        quoteNo,
      ],
    );
    const quote = quoteResult.rows[0];
    await insertQuoteItems(client, quote.id, args.items);

    let activityId: string | null = null;
    if (args.status === 'sent') {
      const [pipelineResult, phaseResult] = await Promise.all([
        client.query('select aktif_faz_no, owner, partner_owner from musteri_pipeline where musteri_id = $1 limit 1', [args.customerId]),
        client.query('select faz_no, iteration_no from pipeline_eventleri where musteri_id = $1 order by created_at desc limit 1', [args.customerId]),
      ]);
      const pipeline = pipelineResult.rows[0];
      const latestPhase = phaseResult.rows[0];
      const phaseNo = Number(pipeline?.aktif_faz_no ?? latestPhase?.faz_no ?? 10) || 10;
      const iterationNo = Number(latestPhase?.iteration_no ?? 1) || 1;
      const activityResult = await client.query<{ id: string }>(
        `
          insert into pipeline_eventleri (
            musteri_id, faz_no, iteration_no, event_type, durum, aksiyon, owner,
            partner_owner, baslangic_tarihi, hedef_tarihi, notlar, created_by,
            created_by_user_id, created_by_email
          ) values ($1,$2,$3,'quote_sent','Başlamadı','AKTIVITE:Teklif Paylaşıldı',$4,$5,null,$6,$7,$8,$9,$10)
          returning id
        `,
        [
          args.customerId,
          phaseNo,
          iterationNo,
          String(pipeline?.owner ?? args.ownerName).trim() || null,
          String(pipeline?.partner_owner ?? 'Müşteri').trim() || 'Müşteri',
          args.dates.validUntil || args.dates.followUpDate,
          `Quote ${quoteNo} paylaşıldı. İçerik: ${args.summaryText || '-'} | Geçerlilik: ${args.dates.validUntil}`,
          args.ownerName,
          args.ownerUserId ?? null,
          args.ownerEmail,
        ],
      );
      activityId = activityResult.rows[0]?.id ?? null;
      await client.query('update quotes set activity_event_id = $1 where id = $2', [activityId, quote.id]);
    }

    return { ...quote, activity_id: activityId };
  });
}

export async function updateQuoteTransaction(args: {
  quoteId: string;
  opportunityTitle: string | null;
  probability: number;
  note: string | null;
  totals: QuoteTotals;
  items: ResolvedQuoteLine[];
  activityNote: (quote: { quote_no: string; valid_until: string | null }) => string;
}) {
  return runInTransaction(async (client) => {
    const quoteResult = await client.query<{
      id: string;
      status: string;
      quote_no: string;
      valid_until: string | null;
      activity_event_id: string | null;
    }>('select id, status, quote_no, valid_until, activity_event_id from quotes where id = $1 for update', [args.quoteId]);
    const quote = quoteResult.rows[0];
    if (!quote) throw Object.assign(new Error('Teklif bulunamadı.'), { status: 404 });
    if (quote.status === 'closed') throw Object.assign(new Error('Kapalı teklifler düzenlenemez.'), { status: 400 });

    await client.query(
      `
        update quotes set opportunity_title=$1, probability=$2, note=$3,
          total_device_count=$4, total_amount=$5, monthly_amount=$6, hardware_amount=$7
        where id=$8
      `,
      [
        args.opportunityTitle,
        args.probability,
        args.note,
        args.totals.totalDeviceCount,
        args.totals.totalAmount,
        args.totals.monthlyAmount,
        args.totals.hardwareAmount,
        args.quoteId,
      ],
    );
    await client.query('delete from quote_items where quote_id = $1', [args.quoteId]);
    await insertQuoteItems(client, args.quoteId, args.items);

    if (quote.status === 'sent' && quote.activity_event_id) {
      await client.query('update pipeline_eventleri set notlar = $1 where id = $2', [args.activityNote(quote), quote.activity_event_id]);
    }

    return quote;
  });
}
