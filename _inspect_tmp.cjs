const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const musteriler = await client.query(`select musteri, entegrasyon_tipi, sektor, is_kolu from public.musteriler order by musteri`);
  console.log('--- musteriler count:', musteriler.rows.length);
  console.log(JSON.stringify(musteriler.rows, null, 0));

  const fazlar = await client.query(`select faz_no, asama_adi, owner from public.is_ortagi_faz_tanimlari order by faz_no`);
  console.log('--- is_ortagi_faz_tanimlari:');
  console.log(JSON.stringify(fazlar.rows, null, 0));

  const fazlar2 = await client.query(`select faz_no, asama_adi, owner from public.faz_tanimlari order by faz_no`);
  console.log('--- faz_tanimlari:');
  console.log(JSON.stringify(fazlar2.rows, null, 0));

  const params = await client.query(`select group_key, param_key, value, meta from public.system_parameters where group_key in ('crm_sector','kunye_is_kolu') order by group_key, sort_order`);
  console.log('--- system_parameters:');
  console.log(JSON.stringify(params.rows, null, 0));

  const eventTypes = await client.query(`select unnest(enum_range(NULL::public.pipeline_event_type_enum)) as v`);
  console.log('--- pipeline_event_type_enum:');
  console.log(JSON.stringify(eventTypes.rows, null, 0));

  const durumEnum = await client.query(`select unnest(enum_range(NULL::public.faz_durum_enum)) as v`);
  console.log('--- faz_durum_enum:');
  console.log(JSON.stringify(durumEnum.rows, null, 0));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
