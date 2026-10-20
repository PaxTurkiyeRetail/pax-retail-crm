import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Default is a READ ONLY preflight. Production application requires explicit --apply.
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const rollbackPath = option('--rollback');
const backupPath = option('--backup');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--apply') continue;
  if (['--backup', '--rollback'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
  throw new Error('Usage: [--apply --backup FILE] or [--rollback FILE [--apply]]');
}
if (apply && !rollbackPath && !backupPath) throw new Error('--apply requires --backup FILE (a new file).');
const fixes = [
  { key: '107', sale: '363e7339-281b-4a1e-8774-3ba081c81c90', item: 'd9986922-ef24-4986-9806-586d0cbffbda', code: 'A6630', qty: 15, unit: 405, old: 6.08, next: 6075 },
  { key: '109', sale: '819bf74f-d102-4477-8453-cf941dd9c9cc', item: '721e35e1-6ea8-422f-9e6c-2350f5ad311d', code: 'S210', qty: 26, unit: 77, old: 2, next: 2002 },
  { key: '111', sale: '1c02f748-3add-48c8-848c-070a0069820a', item: 'e33ed587-622b-4294-a277-cc29e21021e3', code: 'A80', qty: 255, unit: 199, old: 50.74, next: 50745 },
  { key: '112', sale: '1c02f748-3add-48c8-848c-070a0069820a', item: '86af6f55-f996-40e4-9db5-98a3410fa5b8', code: 'S210', qty: 255, unit: 77, old: 19.64, next: 19635 },
];
const heads = [
  { id: fixes[0].sale, customer: '97200fd0-8226-4c18-8165-1fa557053dae', date: '2026-06-19', old: 6.08, next: 6075 },
  { id: fixes[1].sale, customer: '8b253a1a-741e-4f6a-9799-d87834f46e72', date: '2026-06-26', old: 7204, next: 9204 },
  { id: fixes[2].sale, customer: 'af377b9d-08ad-4181-beef-b400b6df3701', date: '2026-06-29', old: 70.38, next: 70380 },
];
const cents = value => Math.round(Number(value) * 100);
const same = (actual, expected, label) => assert.equal(cents(actual), cents(expected), label);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let transaction = false;
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; load with node --env-file.');
  await db.connect();
  await db.query(apply ? 'begin isolation level serializable' : 'begin isolation level serializable read only');
  transaction = true;
  await db.query("set local statement_timeout='20s'");
  await db.query("set local lock_timeout='5s'");
  const lock = apply ? ' for update' : '';
  const staging = (await db.query(`select id::text,import_key,sale_id::text,customer_id::text,sale_date::text,device_count,unit_price,amount from public.crm_sales_import_pivot where import_key=any($1::text[]) order by import_key${lock}`, [fixes.map(f => 'pivot-10.09.2026-' + f.key)])).rows;
  const items = (await db.query(`select id::text,sale_id::text,product_code,quantity,unit_price,total_price,sale_type from public.crm_sale_items where sale_id=any($1::uuid[]) order by id${lock}`, [heads.map(h => h.id)])).rows;
  const sales = (await db.query(`select id::text,customer_id::text,sale_date::text,amount,hardware_amount,currency,status,source,price_source,quote_id::text,created_by from public.crm_sales where id=any($1::uuid[]) order by id${lock}`, [heads.map(h => h.id)])).rows;
  assert.equal(staging.length, 4, 'Exactly four source staging rows required');
  assert.equal(sales.length, 3, 'Exactly three sale heads required');
  assert.equal(items.length, 5, 'Expected unchanged five-item shape in three sales');
  const rollback = rollbackPath ? JSON.parse(await readFile(resolve(rollbackPath), 'utf8')) : null;
  if (rollback) assert.equal(rollback.repair, 'retail-2026-import-amounts-v1');
  for (const f of fixes) {
    same(f.qty * f.unit, f.next, 'Reviewed quantity × price must equal target');
    const p = staging.find(p => p.import_key === 'pivot-10.09.2026-' + f.key);
    const i = items.find(i => i.id === f.item);
    const s = sales.find(s => s.id === f.sale);
    assert.ok(p && i && s, 'Exact source/item/head mapping required');
    assert.equal(p.sale_id, f.sale); assert.equal(i.sale_id, f.sale);
    assert.equal(p.customer_id, s.customer_id); assert.equal(p.sale_date, s.sale_date);
    assert.equal(Number(p.device_count), f.qty); assert.equal(Number(i.quantity), f.qty);
    same(p.unit_price, f.unit, 'Staging unit price'); same(i.unit_price, f.unit, 'Item unit price');
    assert.equal(i.product_code, f.code); assert.equal(i.sale_type, 'sale');
    same(p.amount, rollback ? f.next : f.old, 'Exact old staging amount');
    same(i.total_price, rollback ? f.next : f.old, 'Exact old item amount');
    if (rollback) {
      const previous = rollback.staging.find(x => x.id === p.id);
      same(previous?.amount, f.old, 'Backup source amount');
      same(rollback.items.find(x => x.id === i.id)?.total_price, f.old, 'Backup item amount');
    }
  }
  // Lee Cooper A80 is deliberately preserved: its source agreement differs from qty × unit.
  const untouched = items.find(i => i.id === 'ea2fe3df-a32c-4f0a-b3da-62658a1cfe16');
  assert.ok(untouched); same(untouched.total_price, 7202, 'Untouched Lee A80 agreement');
  for (const h of heads) {
    const s = sales.find(s => s.id === h.id);
    assert.equal(s.customer_id, h.customer, 'Frozen reviewed customer identity');
    assert.equal(s.sale_date, h.date, 'Frozen reviewed 2026 sale date');
    assert.equal(s.sale_date.slice(0,4), '2026', 'Only reviewed 2026 imported sales permitted');
    assert.equal(s.status, 'active'); assert.equal(s.currency, 'USD'); assert.equal(s.source, 'direct');
    assert.equal(s.price_source, 'manual'); assert.equal(s.quote_id, null);
    assert.ok(s.created_by.startsWith('import:satis-pivot-'), 'Only imported sales permitted');
    same(s.amount, rollback ? h.next : h.old, 'Exact old sale amount');
    same(s.hardware_amount, rollback ? h.next : h.old, 'Exact old hardware amount');
    same(items.filter(i => i.sale_id === h.id).reduce((a, i) => a + Number(i.total_price), 0), rollback ? h.next : h.old, 'Existing head must reconcile to its items');
    if (rollback) {
      const previous = rollback.sales.find(x => x.id === s.id);
      same(previous?.amount, h.old, 'Backup sale amount'); same(previous?.hardware_amount, h.old, 'Backup hardware amount');
    }
  }
  const observation = { mode: rollback ? 'rollback' : 'repair', apply, stagingRows: 4, itemRows: 4, saleHeads: 3, deltaUsd: rollback ? -78378.54 : 78378.54 };
  if (!apply) { await db.query('rollback'); transaction = false; console.log(JSON.stringify({ ...observation, readOnly: true, preflight: 'passed' })); }
  else {
    if (!rollback) {
      // Minimal backup: identifiers and changed amounts only, no names, notes or credentials.
      const backup = { repair: 'retail-2026-import-amounts-v1', staging: staging.map(p => ({ id: p.id, amount: p.amount })), items: items.filter(i => fixes.some(f => f.item === i.id)).map(i => ({ id: i.id, total_price: i.total_price })), sales: sales.map(s => ({ id: s.id, amount: s.amount, hardware_amount: s.hardware_amount })) };
      const path = resolve(backupPath); await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ backup: path }));
    }
    for (const f of fixes) {
      const old = rollback ? f.next : f.old; const next = rollback ? f.old : f.next;
      const p = staging.find(p => p.sale_id === f.sale && p.import_key.endsWith(f.key));
      assert.equal((await db.query('update public.crm_sales_import_pivot set amount=$1 where id=$2::uuid and amount=$3', [next, p.id, old])).rowCount, 1);
      assert.equal((await db.query('update public.crm_sale_items set total_price=$1 where id=$2::uuid and sale_id=$3::uuid and total_price=$4', [next, f.item, f.sale, old])).rowCount, 1);
    }
    for (const h of heads) {
      const old = rollback ? h.next : h.old; const next = rollback ? h.old : h.next;
      assert.equal((await db.query('update public.crm_sales set amount=$1,hardware_amount=$1 where id=$2::uuid and amount=$3 and hardware_amount=$3', [next, h.id, old])).rowCount, 1);
      const total = (await db.query('select sum(total_price) as total from public.crm_sale_items where sale_id=$1::uuid', [h.id])).rows[0].total;
      same(total, next, 'Post-write item/head reconciliation');
    }
    // Read back full reviewed metadata, not only row counts (guards against trigger side effects).
    const readbackSources = (await db.query('select id::text,import_key,sale_id::text,customer_id::text,sale_date::text,device_count,unit_price,amount from public.crm_sales_import_pivot where import_key=any($1::text[]) order by import_key', [fixes.map(f => 'pivot-10.09.2026-' + f.key)])).rows;
    const readbackItems = (await db.query('select id::text,sale_id::text,product_code,quantity,unit_price,total_price,sale_type from public.crm_sale_items where sale_id=any($1::uuid[]) order by id', [heads.map(h => h.id)])).rows;
    const readbackSales = (await db.query('select id::text,customer_id::text,sale_date::text,amount,hardware_amount,currency,status,source,price_source,quote_id::text,created_by from public.crm_sales where id=any($1::uuid[]) order by id', [heads.map(h => h.id)])).rows;
    const expectedSources = staging.map(p => ({ ...p, amount: String(rollback ? fixes.find(f => p.import_key.endsWith(f.key)).old : fixes.find(f => p.import_key.endsWith(f.key)).next) }));
    const expectedItems = items.map(i => { const f = fixes.find(f => f.item === i.id); return f ? { ...i, total_price: String(rollback ? f.old : f.next) } : i; });
    const expectedSales = sales.map(s => { const h = heads.find(h => h.id === s.id); return { ...s, amount: String(rollback ? h.old : h.next), hardware_amount: String(rollback ? h.old : h.next) }; });
    // PostgreSQL numeric text formatting may preserve scale; compare amounts in integer cents.
    const normalized = (rows, numericKeys) => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, numericKeys.includes(key) ? cents(value) : value])));
    assert.deepEqual(normalized(readbackSources, ['amount', 'unit_price']), normalized(expectedSources, ['amount', 'unit_price']));
    assert.deepEqual(normalized(readbackItems, ['total_price', 'unit_price']), normalized(expectedItems, ['total_price', 'unit_price']));
    assert.deepEqual(normalized(readbackSales, ['amount', 'hardware_amount']), normalized(expectedSales, ['amount', 'hardware_amount']));
    await db.query('commit'); transaction = false;
    console.log(JSON.stringify({ ...observation, committed: true }));
  }
} catch (error) {
  if (transaction) await db.query('rollback').catch(() => {});
  // Avoid echoing DB connection details or unrelated record content.
  console.error('RETAIL_REPAIR_ABORTED', error.code ?? error.name, error instanceof assert.AssertionError ? error.message : 'Preflight, backup, or transaction failed; no transaction committed.');
  process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
