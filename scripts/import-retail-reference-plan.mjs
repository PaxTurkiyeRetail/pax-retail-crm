import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseRetailReferencePlan, parseRetailReferencePool, matchRetailReferencePool } from './retail-reference-plan-parser.mjs';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
for (let i = 0; i < args.length; i++) {
  if (['--apply', '--include-pool'].includes(args[i])) continue;
  if (['--source', '--backup', '--customer-map'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
  throw new Error('Usage: --source HTML [--include-pool] [--customer-map JSON] [--apply --backup NEW_FILE]');
}
const sourcePath = option('--source');
if (!sourcePath) throw new Error('--source HTML is required.');
const apply = args.includes('--apply');
const backupPath = option('--backup');
if (apply && !backupPath) throw new Error('--apply requires --backup NEW_FILE.');
const html = await readFile(resolve(sourcePath), 'utf8');
const parsed = parseRetailReferencePlan(html);
const pool = args.includes('--include-pool') ? parseRetailReferencePool(html) : null;
const mappingPath = option('--customer-map');
const mapping = mappingPath ? JSON.parse(await readFile(resolve(mappingPath), 'utf8')) : {};
if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new Error('Customer map must be an object of exact source firm names to reviewed UUIDs.');
for (const [firm, id] of Object.entries(mapping)) {
  assert.ok(parsed.rows.some(row => row.firmName === firm), 'Unknown source firm in customer map');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Reviewed customer UUID required');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; load using node --env-file.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let transaction = false;
try {
  await db.connect();
  await db.query(apply ? 'begin isolation level serializable' : 'begin isolation level serializable read only');
  transaction = true;
  await db.query("set local statement_timeout='20s'");
  await db.query("set local lock_timeout='5s'");
  if (apply) await db.query("select pg_advisory_xact_lock(hashtextextended('retail-reference-plan-2026-2027',0))");
  const keys = parsed.rows.map(row => row.referenceKey);
  const existing = (await db.query(`select id::text,reference_key,reference_snapshot,updated_at::text from public.crm_retail_plan_entries where reference_key=any($1::text[])${apply ? ' for update' : ''}`, [keys])).rows;
  for (const row of existing) assert.equal(row.reference_snapshot?.sourceSha256, parsed.sourceSha256, 'Existing reference source differs; do not overwrite or mix source versions');
  const customerIds = [...new Set(Object.values(mapping))];
  if (customerIds.length) {
    const customers = (await db.query('select id::text,is_kolu from public.musteriler where id=any($1::uuid[])', [customerIds])).rows;
    assert.equal(customers.length, customerIds.length, 'Every reviewed customer must exist');
    for (const customer of customers) assert.equal(customer.is_kolu, 'Retail', 'Reviewed customer must belong to Retail');
  }
  const insert = parsed.rows.filter(row => !existing.some(saved => saved.reference_key === row.referenceKey));
  const poolRows = pool ? matchRetailReferencePool(pool.rows, (await db.query('select id::text,musteri as name from public.musteriler')).rows) : [];
  const existingPool = pool ? (await db.query(`select customer_id::text,reference_key,reference_snapshot,updated_at::text from public.crm_retail_pool_memberships where reference_key=any($1::text[]) or customer_id=any($2::uuid[])${apply ? ' for update' : ''}`, [poolRows.map(row => row.referenceKey), poolRows.map(row => row.customerId)])).rows : [];
  for (const saved of existingPool) {
    const source = poolRows.find(row => row.referenceKey === saved.reference_key);
    assert.ok(source, 'Existing membership identity conflicts with source reference');
    assert.equal(saved.customer_id, source.customerId, 'Membership customer identity cannot be overwritten');
    assert.equal(saved.reference_snapshot?.sourceSha256, parsed.sourceSha256, 'Existing pool source differs; preserve user edits');
  }
  const insertPool = poolRows.filter(row => !existingPool.some(saved => saved.reference_key === row.referenceKey));
  const summary = { sourceSha256: parsed.sourceSha256, sourceRows: 32, current2026: { rows: 15, quantity: 5186 }, next2027: { rows: 17, quantity: 6595 }, toInsert: insert.length, preservedExisting: existing.length, linkedCustomers: insert.filter(row => mapping[row.firmName]).length, unmatchedCustomerRows: insert.filter(row => !mapping[row.firmName]).length, poolSourceRows: poolRows.length, poolToInsert: insertPool.length, poolPreserved: existingPool.length };
  if (!apply) {
    await db.query('rollback'); transaction = false;
    console.log(JSON.stringify({ ...summary, readOnly: true, preflight: 'passed' }));
  } else {
    const backup = { operation: 'retail-reference-plan-import-v1', sourceSha256: parsed.sourceSha256,
      sourceRows: parsed.rows, existing: existing.map(row => ({ id: row.id, referenceKey: row.reference_key, updatedAt: row.updated_at })),
      insertReferenceKeys: insert.map(row => row.referenceKey), reviewedCustomerMap: mapping,
      poolSourceRows: poolRows, poolExisting: existingPool, poolInsertReferenceKeys: insertPool.map(row => row.referenceKey) };
    const path = resolve(backupPath); await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 });
    const inserted = [];
    for (const row of insert) {
      const result = await db.query(`insert into public.crm_retail_plan_entries
        (reference_key,plan_year,plan_month,customer_id,firm_name,product_code,quantity,business_model,probability,note,unit_price,rental_monthly_price,is_active,source_name,reference_snapshot)
        values($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14::jsonb) returning id::text,reference_key`,
      [row.referenceKey,row.planYear,row.planMonth,mapping[row.firmName]??null,row.firmName,row.productCode,row.quantity,row.businessModel,row.probability,row.note,row.unitPrice,row.rentalMonthlyPrice,row.sourceName,JSON.stringify(row.referenceSnapshot)]);
      assert.equal(result.rowCount, 1); inserted.push(result.rows[0]);
    }
    const insertedMemberships = [];
    for (const row of insertPool) {
      const result = await db.query(`insert into public.crm_retail_pool_memberships(customer_id,reference_key,reference_name,retail_status,register_vendor_group,source_name,reference_snapshot)
        values($1::uuid,$2,$3,$4,$5,$6,$7::jsonb) returning customer_id::text,reference_key`,
      [row.customerId,row.referenceKey,row.referenceName,row.retailStatus,row.registerVendorGroup,row.sourceName,JSON.stringify(row.referenceSnapshot)]);
      assert.equal(result.rowCount, 1); insertedMemberships.push(result.rows[0]);
    }
    const stored = (await db.query('select reference_key,plan_year,plan_month,customer_id::text,firm_name,product_code,quantity,business_model,probability,note,unit_price,rental_monthly_price,is_active,source_name,reference_snapshot from public.crm_retail_plan_entries where reference_key=any($1::text[])', [insert.map(row => row.referenceKey)])).rows;
    assert.equal(stored.length, insert.length);
    for (const row of insert) {
      const saved = stored.find(saved => saved.reference_key === row.referenceKey);
      assert.deepEqual(saved, { reference_key: row.referenceKey, plan_year: row.planYear, plan_month: row.planMonth, customer_id: mapping[row.firmName]??null,
        firm_name: row.firmName, product_code: row.productCode, quantity: row.quantity, business_model: row.businessModel, probability: row.probability,
        note: row.note, unit_price: null, rental_monthly_price: saved.rental_monthly_price, is_active: true, source_name: row.sourceName, reference_snapshot: row.referenceSnapshot });
      assert.equal(saved.rental_monthly_price == null ? null : Number(saved.rental_monthly_price), row.rentalMonthlyPrice);
    }
    if (pool) {
      const savedPool = (await db.query('select customer_id::text,reference_key,reference_name,retail_status,register_vendor_group,source_name,reference_snapshot from public.crm_retail_pool_memberships where reference_key=any($1::text[])', [insertPool.map(row => row.referenceKey)])).rows;
      assert.equal(savedPool.length, insertPool.length);
      for (const row of insertPool) assert.deepEqual(savedPool.find(saved => saved.reference_key === row.referenceKey), {
        customer_id: row.customerId, reference_key: row.referenceKey, reference_name: row.referenceName,
        retail_status: row.retailStatus, register_vendor_group: row.registerVendorGroup,
        source_name: row.sourceName, reference_snapshot: row.referenceSnapshot,
      });
    }
    // Persist inserted IDs before COMMIT. On any failure DB rolls back; backup records only attempted IDs.
    await writeFile(path + '.inserted.json', JSON.stringify({ operation: backup.operation, sourceSha256: parsed.sourceSha256, inserted, insertedMemberships }, null, 2), { flag: 'wx', mode: 0o600 });
    await db.query('commit'); transaction = false;
    console.log(JSON.stringify({ ...summary, committed: true, inserted: inserted.length, insertedMemberships: insertedMemberships.length, backup: path }));
  }
} catch (error) {
  if (transaction) await db.query('rollback').catch(() => {});
  // Assertion diffs can contain source notes or Account names inside the immutable snapshot.
  // Never echo those records to deployment logs.
  const safeDetail = error.message?.startsWith('Retail reference: CRM eşlemesi başarısız:')
    ? error.message : 'Preflight, backup, or integrity check failed; no transaction committed.';
  console.error('RETAIL_PLAN_IMPORT_ABORTED', error.code ?? error.name, safeDetail);
  process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
