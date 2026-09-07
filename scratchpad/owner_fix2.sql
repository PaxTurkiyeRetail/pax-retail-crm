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
