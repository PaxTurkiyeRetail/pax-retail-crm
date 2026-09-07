begin;

with dup_names(musteri) as (
  values
  ('POS AŞ (Toshiba)'),
  ('Otomat360 (Serpet Otomasyon)'),
  ('312 POS Yazılım'),
  ('Fastsell Yazılım'),
  ('Obinova'),
  ('Oxivo'),
  ('Serim Yazılım'),
  ('Vascomm'),
  ('Pomsan'),
  ('Bilecik Bel. (in-house)'),
  ('Beltaş')
),
ids as (
  select m.id from public.musteriler m join dup_names d on m.musteri = d.musteri
)
delete from public.pipeline_eventleri where musteri_id in (select id from ids);

with dup_names(musteri) as (
  values
  ('POS AŞ (Toshiba)'),
  ('Otomat360 (Serpet Otomasyon)'),
  ('312 POS Yazılım'),
  ('Fastsell Yazılım'),
  ('Obinova'),
  ('Oxivo'),
  ('Serim Yazılım'),
  ('Vascomm'),
  ('Pomsan'),
  ('Bilecik Bel. (in-house)'),
  ('Beltaş')
),
ids as (
  select m.id from public.musteriler m join dup_names d on m.musteri = d.musteri
)
delete from public.musteri_pipeline where musteri_id in (select id from ids);

delete from public.musteriler where musteri in (
  'POS AŞ (Toshiba)',
  'Otomat360 (Serpet Otomasyon)',
  '312 POS Yazılım',
  'Fastsell Yazılım',
  'Obinova',
  'Oxivo',
  'Serim Yazılım',
  'Vascomm',
  'Pomsan',
  'Bilecik Bel. (in-house)',
  'Beltaş'
);

commit;
