begin;

with names(musteri) as (
  values
  ('NTTData'),('Menulux'),('ESKİ'),('EvsePOS'),('Ditravo'),('Phoenix'),
  ('Assist Yazılım (Nebim Bayi)'),('Siber Teknoloji'),('Tepe Bİlişim'),('RPS Otomasyon'),
  ('Platforta'),('Neftgen'),('BinBin Scooter (in-house)'),('Diana Travel'),
  ('Kaner Group (in-house)'),('TaksidePOS'),('MLPCare'),('Aktive Otomat'),
  ('Integra Sistem (7A Bilişim)'),('Pem Enerji'),('Ata Üni.'),('Wat Mobilite (Koç)'),
  ('Kalyon'),('Birikim Bilgisayar'),('Rotawatt'),('Velmor'),('Suffatech'),
  ('Electroop'),('Fling Photo Studio'),('Anttech'),('TDV'),('TechoPark'),
  ('Microsoft Dynamics'),('Mergen Yazılım'),('Missha Kozmetik'),('Faturamatik')
),
ids as (
  select m.id from public.musteriler m join names n on m.musteri = n.musteri
)
update public.musteri_pipeline set owner = 'İş Ortakları'
where musteri_id in (select id from ids) and owner = 'Taha Bitim';

with names(musteri) as (
  values
  ('NTTData'),('Menulux'),('ESKİ'),('EvsePOS'),('Ditravo'),('Phoenix'),
  ('Assist Yazılım (Nebim Bayi)'),('Siber Teknoloji'),('Tepe Bİlişim'),('RPS Otomasyon'),
  ('Platforta'),('Neftgen'),('BinBin Scooter (in-house)'),('Diana Travel'),
  ('Kaner Group (in-house)'),('TaksidePOS'),('MLPCare'),('Aktive Otomat'),
  ('Integra Sistem (7A Bilişim)'),('Pem Enerji'),('Ata Üni.'),('Wat Mobilite (Koç)'),
  ('Kalyon'),('Birikim Bilgisayar'),('Rotawatt'),('Velmor'),('Suffatech'),
  ('Electroop'),('Fling Photo Studio'),('Anttech'),('TDV'),('TechoPark'),
  ('Microsoft Dynamics'),('Mergen Yazılım'),('Missha Kozmetik'),('Faturamatik')
),
ids as (
  select m.id from public.musteriler m join names n on m.musteri = n.musteri
)
update public.pipeline_eventleri set owner = 'İş Ortakları'
where musteri_id in (select id from ids) and owner = 'Taha Bitim';

commit;
