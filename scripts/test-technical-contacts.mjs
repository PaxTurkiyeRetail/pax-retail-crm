import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrationSections } from './migration-sections.mjs';
const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost');
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Requires a local test database.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('begin');
  await client.query("set local statement_timeout = '10s'");
  const sections = migrationSections('20260818_004_consolidated_schema_baseline.sql', await readFile(new URL('../db/migrations/20260818_004_consolidated_schema_baseline.sql', import.meta.url), 'utf8'));
  await client.query(sections.find(s => s.version === '20260907_013_customer_technical_contacts.sql').sql);
  const firms = (await client.query("insert into musteriler(musteri) values ('Contact regression A'),('Contact regression B') returning id")).rows;
  const contact = (await client.query("insert into customer_technical_contacts(customer_id,full_name) values($1,'Test Contact') returning id", [firms[0].id])).rows[0];
  const insertEvent = firmId => client.query("insert into pipeline_eventleri(musteri_id,technical_contact_id,event_type,activity_scope,affects_phase) values($1,$2,'note_added','technical',false) returning id", [firmId, contact.id]);
  await client.query('savepoint invalid_link');
  await assert.rejects(insertEvent(firms[1].id), e => e.code === '23503');
  await client.query('rollback to savepoint invalid_link');
  const event = (await insertEvent(firms[0].id)).rows[0];
  await client.query('update customer_technical_contacts set is_active=false where id=$1', [contact.id]);
  assert.equal((await client.query('select technical_contact_id from pipeline_eventleri where id=$1', [event.id])).rows[0].technical_contact_id, contact.id);
  await client.query('savepoint delete_contact');
  await assert.rejects(client.query('delete from customer_technical_contacts where id=$1', [contact.id]), e => e.code === '23503');
  await client.query('rollback to savepoint delete_contact');
  console.log('PASS: migration, cross-firm FK, inactive history, referenced-contact deletion protection (rolled back).');
} finally { await client.query('rollback'); await client.end(); }
