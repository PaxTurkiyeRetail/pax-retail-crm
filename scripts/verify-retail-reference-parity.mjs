import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseRetailReferencePlan, parseRetailReferencePool, matchRetailReferencePool, retailReferenceSalesTotals } from './retail-reference-plan-parser.mjs';

// Intended immediately after the approved import/repair, before deliberate user plan edits.
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--source' || !args[1]) throw new Error('Usage: --source Retail_2026_2027.html');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; load using node --env-file.');
const html = await readFile(resolve(args[1]), 'utf8');
const plan = parseRetailReferencePlan(html), pool = parseRetailReferencePool(html), expectedSales = retailReferenceSalesTotals(html);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const cents = value => Math.round(Number(value) * 100);
let transaction = false;
try {
  await db.connect(); await db.query('begin isolation level repeatable read read only'); transaction = true;
  await db.query("set local statement_timeout='30s'");
  await db.query("set local timezone='UTC'");
  const plans = (await db.query(`select reference_key,plan_year,plan_month,firm_name,product_code,quantity,business_model,probability,note,unit_price,rental_monthly_price,is_active,source_name,reference_snapshot from public.crm_retail_plan_entries where reference_key=any($1::text[])`, [plan.rows.map(row => row.referenceKey)])).rows;
  assert.equal(plans.length, 32, 'Expected 32 reference plan rows');
  for (const source of plan.rows) {
    const row = plans.find(row => row.reference_key === source.referenceKey);
    assert.ok(row, 'Missing reference plan identity');
    assert.deepEqual([row.plan_year,row.plan_month,row.firm_name,row.product_code,row.quantity,row.business_model,row.probability,row.note,row.is_active,row.source_name], [source.planYear,source.planMonth,source.firmName,source.productCode,source.quantity,source.businessModel,source.probability,source.note,true,source.sourceName], 'Plan fields differ from approved reference');
    assert.equal(row.unit_price, null, 'Reference sale unit price must remain derived');
    assert.equal(row.rental_monthly_price == null ? null : Number(row.rental_monthly_price), source.rentalMonthlyPrice, 'Reference rental rate');
    assert.deepEqual(row.reference_snapshot, source.referenceSnapshot, 'Plan source provenance');
  }
  const customers = (await db.query('select id::text,musteri as name from public.musteriler')).rows;
  const expectedPool = matchRetailReferencePool(pool.rows, customers);
  const members = (await db.query(`select customer_id::text,reference_key,reference_name,retail_status,register_vendor_group,source_name,reference_snapshot from public.crm_retail_pool_memberships where reference_key=any($1::text[])`, [pool.rows.map(row => row.referenceKey)])).rows;
  assert.equal(members.length, 530, 'Expected 530 reference memberships');
  for (const source of expectedPool) {
    const row = members.find(row => row.reference_key === source.referenceKey);
    assert.ok(row, 'Missing reference membership identity');
    assert.deepEqual([row.customer_id,row.reference_name,row.retail_status,row.register_vendor_group,row.source_name], [source.customerId,source.referenceName,source.retailStatus,source.registerVendorGroup,source.sourceName], 'Membership fields differ from approved reference');
    assert.deepEqual(row.reference_snapshot, source.referenceSnapshot, 'Membership source provenance');
  }
  const repairs = [
    ['107','d9986922-ef24-4986-9806-586d0cbffbda',6075],
    ['109','721e35e1-6ea8-422f-9e6c-2350f5ad311d',2002],
    ['111','e33ed587-622b-4294-a277-cc29e21021e3',50745],
    ['112','86af6f55-f996-40e4-9db5-98a3410fa5b8',19635],
  ];
  const staging = (await db.query('select import_key,sale_id::text,amount from public.crm_sales_import_pivot where import_key=any($1::text[])', [repairs.map(([key]) => 'pivot-10.09.2026-' + key)])).rows;
  const items = (await db.query('select id::text,sale_id::text,total_price from public.crm_sale_items where id=any($1::uuid[])', [repairs.map(([, id]) => id)])).rows;
  assert.equal(staging.length, 4); assert.equal(items.length, 4);
  for (const [key, id, amount] of repairs) {
    const source = staging.find(row => row.import_key === 'pivot-10.09.2026-' + key), item = items.find(row => row.id === id);
    assert.ok(source && item, 'Missing reviewed repair row');
    assert.equal(source.sale_id,item.sale_id,'Reviewed source/item sale mapping');
    assert.equal(cents(source.amount),cents(amount),'Repaired source amount');
    assert.equal(cents(item.total_price),cents(amount),'Repaired item amount');
  }
  const sales = (await db.query(`select count(distinct s.customer_id)::int as firms,
    coalesce(sum(i.quantity) filter(where upper(trim(i.product_code))<>'S210'),0)::int as terminals,
    coalesce(sum(i.quantity) filter(where upper(trim(i.product_code))='S210'),0)::int as s210,
    coalesce(sum(i.total_price) filter(where s.currency='USD' and i.sale_type is distinct from 'rental'),0)::numeric as usd
    from public.crm_sales s join public.crm_sale_items i on i.sale_id=s.id join public.musteriler m on m.id=s.customer_id
    where s.status='active' and m.is_kolu='Retail' and s.sale_date>='2026-01-01' and s.sale_date<'2027-01-01'
    and public.crm_sale_item_is_device(i.product_type,i.is_recurring)`)).rows[0];
  assert.equal(sales.firms,expectedSales.firms,'Realized firm count'); assert.equal(sales.terminals,expectedSales.terminals,'Realized terminal count');
  assert.equal(sales.s210,expectedSales.s210,'S210 accessory count'); assert.equal(cents(sales.usd),cents(expectedSales.usd),'Realized USD revenue');
  const digest = async table => (await db.query(`select count(*)::int as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) as digest from public.${table} t`)).rows[0];
  // Table names are developer constants. Hashes only; never print row JSON, notes, or credentials.
  const canonical = { forecasts: await digest('crm_forecasts'), customers: await digest('musteriler') };
  await db.query('rollback'); transaction = false;
  console.log(JSON.stringify({ readOnly: true, verified: true, sourceSha256: plan.sourceSha256, planRows: plans.length, membershipRows: members.length, repairedSourceRows: 4, repairedItemRows: 4, sales: { firms: sales.firms, terminals: sales.terminals, s210: sales.s210, usd: Number(sales.usd) }, canonical }));
} catch (error) {
  if (transaction) await db.query('rollback').catch(() => {});
  // Assertions may contain private source snapshots. Do not echo actual/expected data.
  console.error('RETAIL_REFERENCE_VERIFY_FAILED', error.code ?? error.name, 'Parity or provenance check failed; no data changed.');
  process.exitCode = 1;
} finally { await db.end().catch(() => {}); }
