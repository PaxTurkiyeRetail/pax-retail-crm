import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrationSections } from './migration-sections.mjs';
const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost');
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Requires a local test database.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
try {
  await client.query('begin'); await client.query("set local statement_timeout='20s'");
  const before = (await client.query(`select (select count(*) from musteriler)::int firms,(select count(*) from pipeline_eventleri)::int events,(select count(*) from quotes)::int quotes`)).rows[0];
  const all = migrationSections('20260818_004_consolidated_schema_baseline.sql', await readFile(new URL('../db/migrations/20260818_004_consolidated_schema_baseline.sql', import.meta.url),'utf8'));
  for (const version of ['20260907_012_pipeline_non_phase_activity_guard.sql','20260907_013_customer_technical_contacts.sql','20260907_014_company_roles_and_activity_context.sql']) await client.query(all.find(s=>s.version===version).sql);
  const after = (await client.query(`select (select count(*) from musteriler)::int firms,(select count(*) from pipeline_eventleri)::int events,(select count(*) from quotes)::int quotes`)).rows[0];
  assert.deepEqual(after,before,'migration must not remove or duplicate business data');
  assert.equal(Number((await client.query('select count(*) c from organization_roles')).rows[0].c),before.firms,'every existing firm gets exactly one initial relationship');
  assert.equal(Number((await client.query('select count(*) c from pipeline_eventleri where activity_context is null')).rows[0].c),0,'history receives an explicit context');
  const firm=(await client.query("insert into musteriler(musteri) values('Rollback dual-role firm') returning id")).rows[0];
  await client.query("insert into organization_roles(customer_id,role_key,subtype) values($1,'business_partner','Entegrasyon Firması')",[firm.id]);
  const customerPhase=(await client.query('select faz_no from faz_tanimlari order by faz_no limit 1')).rows[0].faz_no;
  let partnerPhaseRow=(await client.query('select faz_no from is_ortagi_faz_tanimlari where is_active order by faz_no desc limit 1')).rows[0];
  if(!partnerPhaseRow) partnerPhaseRow=(await client.query("insert into is_ortagi_faz_tanimlari(faz_no,asama_adi,owner,is_active,sort_order) values(9001,'Partner Test','Account',true,9001) returning faz_no")).rows[0];
  const partnerPhase=partnerPhaseRow.faz_no;
  const add=async(context,phase,date)=>client.query(`insert into pipeline_eventleri(musteri_id,faz_no,event_type,durum,aksiyon,activity_scope,affects_phase,activity_context,created_at)
    values($1,$2,'note_added','Devam Ediyor','AKTIVITE:Diğer','account',true,$3,$4)`,[firm.id,phase,context,date]);
  await add('customer',customerPhase,'2026-01-01'); await add('business_partner',partnerPhase,'2026-01-02');
  const states=(await client.query('select context_key,active_phase_no from organization_pipeline_states where customer_id=$1 order by context_key',[firm.id])).rows;
  assert.deepEqual(states,[{context_key:'business_partner',active_phase_no:partnerPhase},{context_key:'customer',active_phase_no:customerPhase}]);
  assert.equal((await client.query('select aktif_faz_no from musteri_pipeline where musteri_id=$1',[firm.id])).rows[0].aktif_faz_no,customerPhase,'partner event must not move customer snapshot');
  await client.query('savepoint wrong_phase');
  const partnerOnlyPhase=(await client.query('select p.faz_no from is_ortagi_faz_tanimlari p left join faz_tanimlari c using(faz_no) where p.is_active and c.faz_no is null limit 1')).rows[0];
  if(partnerOnlyPhase) await assert.rejects(add('customer',partnerOnlyPhase.faz_no,'2026-01-03'),e=>e.code==='23514');
  await client.query('rollback to savepoint wrong_phase');
  console.log('PASS: no business-row loss, backfill, dual roles, contextual phase validation and independent snapshots (rolled back).');
} finally { await client.query('rollback'); await client.end(); }
