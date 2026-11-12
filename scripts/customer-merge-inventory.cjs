#!/usr/bin/env node
// Read-only preflight. Run only against the explicitly intended PostgreSQL database.
// DATABASE_URL must already be present in the environment; this script never reads .env.
const { Client } = require('pg');

const pairs = [
  ['ATİKER', 'ATİKER YAZILIM'], ['KALEM YAZILIM', 'KALEM'],
  ['TURKUAZ YAZILIM', 'TURKUAZ'], ['TOSHIBA (POS AŞ)', 'TOSHİBA'],
  ['BURULAŞ', 'BURULAS'], ['OMNİPOS YAZILIM', 'OMNİPOS'],
  ['ERP 12 YAZILIM', 'ERP12'], ['VEGA YAZILIM A.Ş', 'VEGA YAZILIM'],
  ['İMZA BARKOD(MİZAN YAZILIM)', 'İMZA BARKOD (MİZAN YAZILIM)'],
  ['POSISTANT YAZILIM', 'POSİSTANT'], ['HEPSİJET', 'HEPSİ JET'],
  ['MEDİCALPARK', 'MEDİCAL PARK'], ['BİRİKİM BİLGİSAYAR', 'BİRİKİM BİLGİSİYAR'],
];
const ident = (value) => '"' + String(value).replace(/"/g, '""') + '"';
const relation = (schema, table) => `${ident(schema)}.${ident(table)}`;

async function inventory(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  try {
    const identity = await client.query('select current_database() as database, current_user as db_user, inet_server_addr()::text as server_address, inet_server_port() as server_port');
    const names = [...new Set(pairs.flat())];
    const customers = await client.query('select id::text, musteri, sorumlu, customer_type from public.musteriler where musteri = any($1::text[]) order by musteri, id', [names]);
    const fks = await client.query(`
      select con.conname, ns.nspname as schema_name, rel.relname as table_name,
             pg_get_constraintdef(con.oid) as definition, con.condeferrable, con.condeferred
      from pg_constraint con join pg_class rel on rel.oid=con.conrelid
      join pg_namespace ns on ns.oid=rel.relnamespace
      where con.contype='f' and con.confrelid='public.musteriler'::regclass
      order by 2,3,1`);
    // Include UUID/text columns by conventional customer identity names, even when no FK exists,
    // and columns carrying direct foreign keys to musteriler, regardless of their names.
    const columns = await client.query(`
      select distinct ns.nspname as schema_name, rel.relname as table_name, a.attname as column_name,
             format_type(a.atttypid,a.atttypmod) as type_name
      from pg_class rel join pg_namespace ns on ns.oid=rel.relnamespace
      join pg_attribute a on a.attrelid=rel.oid and a.attnum>0 and not a.attisdropped
      where ns.nspname='public' and rel.relkind in ('r','p') and rel.relname <> 'musteriler'
        and ((a.attname ~* '(^|_)(customer|musteri|crm_firm)(_id|id)$' and a.atttypid in ('uuid'::regtype,'text'::regtype,'varchar'::regtype))
          or exists (select 1 from pg_constraint c where c.contype='f' and c.conrelid=rel.oid
             and c.confrelid='public.musteriler'::regclass and a.attnum=any(c.conkey)))
      order by 1,2,3`);
    const uniqueIndexes = await client.query(`
      select ns.nspname as schema_name, rel.relname as table_name, idx.relname as index_name,
             pg_get_indexdef(i.indexrelid) as definition,
             i.indpred is not null as partial, i.indexprs is not null as expression,
             array(select a.attname::text from unnest(i.indkey::smallint[]) with ordinality k(attnum,ord)
               join pg_attribute a on a.attrelid=rel.oid and a.attnum=k.attnum
               where k.ord<=i.indnkeyatts order by k.ord) as key_columns
      from pg_index i join pg_class rel on rel.oid=i.indrelid join pg_class idx on idx.oid=i.indexrelid
      join pg_namespace ns on ns.oid=rel.relnamespace
      where i.indisunique and ns.nspname='public' order by 1,2,3`);
    const triggers = await client.query(`
      select ns.nspname as schema_name, rel.relname as table_name, t.tgname,
             t.tgenabled, pg_get_triggerdef(t.oid) as definition
      from pg_trigger t join pg_class rel on rel.oid=t.tgrelid
      join pg_namespace ns on ns.oid=rel.relnamespace
      where ns.nspname='public' and not t.tgisinternal order by 1,2,3`);
    const relevant = new Set(columns.rows.map(c => `${c.schema_name}.${c.table_name}`));
    relevant.add('public.musteriler');
    const indexes = uniqueIndexes.rows.filter(i => relevant.has(`${i.schema_name}.${i.table_name}`));
    const counts = [];
    const collisionChecks = [];
    const byName = new Map(names.map(n => [n, customers.rows.filter(c => c.musteri === n)]));
    for (const [keepName, sourceName] of pairs) {
      const keep = byName.get(keepName), source = byName.get(sourceName);
      if (keep.length !== 1 || source.length !== 1) {
        counts.push({ keepName, sourceName, error: 'Ad bir kez bulunmadı; bu çift için sayım yapılmadı.', keepMatches: keep.length, sourceMatches: source.length });
        continue;
      }
      for (const col of columns.rows) {
        const table = relation(col.schema_name, col.table_name), name = ident(col.column_name);
        const res = await client.query(`select count(*) filter (where ${name}::text=$1) as keep_count, count(*) filter (where ${name}::text=$2) as source_count from ${table} where ${name}::text in ($1,$2)`, [keep[0].id, source[0].id]);
        if (Number(res.rows[0].keep_count) || Number(res.rows[0].source_count)) counts.push({ keepName, sourceName, ...col, ...res.rows[0] });
        for (const index of indexes.filter(i => i.schema_name === col.schema_name && i.table_name === col.table_name && i.key_columns.includes(col.column_name))) {
          if (index.partial || index.expression) {
            collisionChecks.push({ keepName, sourceName, index_name: index.index_name, status: 'manual: partial or expression index', definition: index.definition });
            continue;
          }
          const other = index.key_columns.filter(k => k !== col.column_name);
          const join = other.map(k => `s.${ident(k)} = d.${ident(k)}`).join(' and ') || 'true';
          const clash = await client.query(`select exists(select 1 from ${table} s join ${table} d on ${join} where s.${name}::text=$1 and d.${name}::text=$2) as possible_conflict`, [source[0].id, keep[0].id]);
          if (clash.rows[0].possible_conflict) collisionChecks.push({ keepName, sourceName, index_name: index.index_name, status: 'possible conflict', definition: index.definition });
        }
      }
    }
    return { identity: identity.rows[0], pairs, customers: customers.rows, foreignKeys: fks.rows,
      customerIdentityColumns: columns.rows, nonzeroCounts: counts, uniqueIndexes: indexes,
      collisionChecks, triggers: triggers.rows.filter(t => relevant.has(`${t.schema_name}.${t.table_name}`)),
      limitations: ['Ad alanları, JSON içeriği ve müşteri ID içeren farklı adlandırılmış FK dışı sütunlar ayrıca incelenmelidir.', 'Kısmi/ifade indeksleri ve bileşik yabancı anahtarlar elle değerlendirilmelidir.', 'Künye alan çakışmaları, fazlar ve tetikleyici etkileri satır seviyesinde ayrıca karşılaştırılmalıdır.', 'Sayım güncel snapshot ile sınırlıdır; yazma işlemi öncesi tekrarlanmalıdır.'] };
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  if (!process.env.DATABASE_URL || process.argv[2] !== '--read-only') {
    console.error('Set DATABASE_URL in the environment and pass --read-only for the explicitly intended database.');
    process.exitCode = 2;
    return;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await inventory(client), null, 2));
  } catch (_error) {
    // Driver errors can contain connection strings; never print them.
    console.error('Read-only inventory failed. Check access, schema and database identity without exposing connection credentials.');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
if (require.main === module) main();
module.exports = { ident, relation, pairs, inventory };
