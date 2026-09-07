import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrationSections } from './migration-sections.mjs';

const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('This regression check requires a local test database.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('begin');
  await client.query("set local statement_timeout = '10s'");
  const sections = migrationSections('20260818_004_consolidated_schema_baseline.sql', await readFile(new URL('../db/migrations/20260818_004_consolidated_schema_baseline.sql', import.meta.url), 'utf8'));
  await client.query(sections.find(s => s.version === '20260907_012_pipeline_non_phase_activity_guard.sql').sql);
  const { rows: [firm] } = await client.query("insert into musteriler(musteri) values ('Rollback-only pipeline regression') returning id");
  const phases = (await client.query('select faz_no from faz_tanimlari order by faz_no limit 2')).rows;
  assert.equal(phases.length, 2);
  const insert = async (scope, affects, phase, timestamp) => (await client.query(
    `insert into pipeline_eventleri(musteri_id,faz_no,event_type,durum,activity_scope,affects_phase,created_at,aksiyon)
     values($1,$2,'note_added','Devam Ediyor',$3,$4,$5,'AKTIVITE:Diğer') returning id`,
    [firm.id, phase, scope, affects, timestamp],
  )).rows[0].id;
  const snapshot = async () => (await client.query('select * from musteri_pipeline where musteri_id=$1', [firm.id])).rows[0];
  const account = await insert('account', true, phases[0].faz_no, '2026-01-01T00:00:00Z');
  const initial = await snapshot();
  const technical = await insert('technical', false, phases[1].faz_no, '2026-01-02T00:00:00Z');
  assert.deepEqual(await snapshot(), initial, 'technical insert must not change snapshot');
  await client.query('update pipeline_eventleri set notlar=$1 where id=$2', ['technical note', technical]);
  assert.deepEqual(await snapshot(), initial, 'technical edit must not change snapshot');
  const note = await insert('account', false, phases[1].faz_no, '2026-01-03T00:00:00Z');
  assert.deepEqual(await snapshot(), initial, 'non-phase account note must not change snapshot');
  await client.query('select rebuild_musteri_pipeline($1)', [firm.id]);
  assert.equal((await snapshot()).aktif_faz_no, phases[0].faz_no, 'rebuild must ignore both non-phase entries');
  await client.query("update pipeline_eventleri set activity_scope='account',affects_phase=true where id=$1", [technical]);
  assert.equal((await snapshot()).aktif_faz_no, phases[1].faz_no, 'conversion to account must rebuild');
  await client.query("update pipeline_eventleri set activity_scope='technical',affects_phase=false where id=$1", [technical]);
  assert.equal((await snapshot()).aktif_faz_no, phases[0].faz_no, 'conversion to technical must restore account phase');
  await client.query('delete from pipeline_eventleri where id=$1', [note]);
  assert.equal((await snapshot()).aktif_faz_no, phases[0].faz_no);
  await client.query('delete from pipeline_eventleri where id=$1', [account]);
  assert.equal(await snapshot(), undefined, 'technical-only history must not produce an account pipeline');
  await client.query('delete from pipeline_eventleri where id=$1', [technical]);
  assert.equal(await snapshot(), undefined);
  console.log('PASS: insert, edit, delete, rebuild, scope conversion and technical-only history (all rolled back).');
} finally {
  await client.query('rollback');
  await client.end();
}
