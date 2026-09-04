-- 20260903_011_musteriler_sorumlu_is_ortagi_fix.sql
-- 009/010 migration sonrasi is ortagi importundan kalan 36 firmanin
-- musteri_pipeline.owner / pipeline_eventleri.owner kolonlari 'Is Ortaklari'
-- yapilmisti ama musteriler.sorumlu kolonu bos kalmisti (009'da hic set
-- edilmemisti). Aktivite listesi ekrani (ActivitiesDashboardClient) Sorumlu
-- degerini musteriler.sorumlu'dan okuyor, bu yuzden bos gorunuyordu.
-- Idempotenttir.

begin;

update public.musteriler set sorumlu = 'İş Ortakları'
where musteri in (
  'NTTData','Menulux','ESKİ','EvsePOS','Ditravo','Phoenix',
  'Assist Yazılım (Nebim Bayi)','Siber Teknoloji','Tepe Bİlişim','RPS Otomasyon',
  'Platforta','Neftgen','BinBin Scooter (in-house)','Diana Travel',
  'Kaner Group (in-house)','TaksidePOS','MLPCare','Aktive Otomat',
  'Integra Sistem (7A Bilişim)','Pem Enerji','Ata Üni.','Wat Mobilite (Koç)',
  'Kalyon','Birikim Bilgisayar','Rotawatt','Velmor','Suffatech',
  'Electroop','Fling Photo Studio','Anttech','TDV','TechoPark',
  'Microsoft Dynamics','Mergen Yazılım','Missha Kozmetik','Faturamatik'
) and (sorumlu is null or sorumlu = 'Taha Bitim');

commit;
