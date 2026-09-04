-- 20260903_009_is_ortagi_partner_import.sql
-- Jira "İş Ortakları" board senkronizasyonu (Taha Bitim, 03.09.2026)
-- Kapsam: SADECE DB'de olmayan yeni firmalar eklenir. Mevcut 59+ firmaya DOKUNULMAZ.
-- Durum='Pasif' olan 12 firma atlanmıştır: Utarit, Workcube, NarPOS, Finetech, Kivi ERP, Sedna Cloud, E-kent, Turkuaz Innovation, AltimUSA, Trassir, Tora Enerji, Self Metric
-- Eklenen: 47 firma.
-- Dosya idempotenttir.

-- 1) Yeni 47 firma: musteriler tablosuna eklenir
insert into public.musteriler (musteri, entegrasyon_tipi, is_kolu)
select v.musteri, v.entegrasyon_tipi::public.entegrasyon_tipi_enum, v.is_kolu
from (values
('POS AŞ (Toshiba)', 'D2D+A2A', 'Retail'),
('NTTData', 'D2D', 'Retail'),
('Menulux', 'D2D+A2A', 'Retail'),
('ESKİ', 'D2D', 'Vertical'),
('EvsePOS', 'A2A', 'Vertical'),
('Ditravo', 'D2D+A2A', 'Vertical'),
('Serim Yazılım', 'A2A', 'Vertical'),
('Phoenix', 'D2D', 'Retail'),
('Assist Yazılım (Nebim Bayi)', 'D2D+A2A', 'Retail'),
('Oxivo', 'D2D+A2A', 'Vertical'),
('Siber Teknoloji', 'D2D', 'Retail'),
('Tepe Bİlişim', 'D2D+A2A', 'Retail'),
('RPS Otomasyon', 'A2A', 'Retail'),
('Platforta', 'A2A', 'Vertical'),
('Neftgen', 'A2A', 'Vertical'),
('BinBin Scooter (in-house)', 'A2A', 'Vertical'),
('Diana Travel', 'A2A', 'Vertical'),
('Otomat360 (Serpet Otomasyon)', 'D2D+A2A', 'Retail'),
('Pomsan', 'D2D+A2A', 'Vertical'),
('Bilecik Bel. (in-house)', 'D2D', 'Vertical'),
('Kaner Group (in-house)', 'D2D', 'Retail'),
('TaksidePOS', 'A2A', 'Vertical'),
('MLPCare', 'D2D', 'Vertical'),
('Vascomm', 'D2D+A2A', 'Vertical'),
('Aktive Otomat', 'D2D', 'Vertical'),
('Integra Sistem (7A Bilişim)', 'D2D', 'Vertical'),
('Pem Enerji', 'A2A', 'Vertical'),
('Ata Üni.', 'D2D', 'Vertical'),
('Wat Mobilite (Koç)', null, 'Vertical'),
('Kalyon', null, 'Vertical'),
('Birikim Bilgisayar', 'A2A', 'Retail'),
('Rotawatt', null, 'Vertical'),
('Velmor', 'A2A', 'Vertical'),
('Suffatech', 'A2A', 'Vertical'),
('Obinova', 'A2A', 'Vertical'),
('Electroop', 'A2A', 'Vertical'),
('Fling Photo Studio', 'D2D+A2A', 'Vertical'),
('Beltaş', 'A2A', 'Vertical'),
('Anttech', 'A2A', 'Vertical'),
('TDV', 'D2D', 'Vertical'),
('TechoPark', 'D2D', 'Vertical'),
('Microsoft Dynamics', 'D2D', 'Retail'),
('Mergen Yazılım', 'D2D', 'Vertical'),
('Missha Kozmetik', 'D2D', 'Retail'),
('Faturamatik', 'A2A', 'Vertical'),
('Fastsell Yazılım', 'D2D+A2A', 'Retail'),
('312 POS Yazılım', 'D2D+A2A', 'Retail')
) as v(musteri, entegrasyon_tipi, is_kolu)
where not exists (select 1 from public.musteriler m where m.musteri = v.musteri);

-- 2) Yeni eklenen firmalar için pipeline durumu
insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'POS AŞ (Toshiba)'), 10, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'POS AŞ (Toshiba)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'NTTData'), 10, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'NTTData') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Menulux'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (JAR)'
where (select id from public.musteriler where musteri = 'Menulux') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'ESKİ'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'ESKİ') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'EvsePOS'), 11, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'EvsePOS') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Ditravo'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (JAR)'
where (select id from public.musteriler where musteri = 'Ditravo') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Serim Yazılım'), 14, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Serim Yazılım') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Phoenix'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Phoenix') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Assist Yazılım (Nebim Bayi)'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Assist Yazılım (Nebim Bayi)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Oxivo'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Oxivo') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Siber Teknoloji'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Siber Teknoloji') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Tepe Bİlişim'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Tepe Bİlişim') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'RPS Otomasyon'), 10, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'RPS Otomasyon') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Platforta'), 10, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Platforta') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Neftgen'), 10, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Neftgen') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'BinBin Scooter (in-house)'), 10, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'BinBin Scooter (in-house)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Diana Travel'), 14, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Diana Travel') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Otomat360 (Serpet Otomasyon)'), 8, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Vendlink (MDB)'
where (select id from public.musteriler where musteri = 'Otomat360 (Serpet Otomasyon)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Pomsan'), 8, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Harici Cihaz P. (RS232)'
where (select id from public.musteriler where musteri = 'Pomsan') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Bilecik Bel. (in-house)'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Bilecik Bel. (in-house)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Kaner Group (in-house)'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Kaner Group (in-house)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'TaksidePOS'), 14, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'TaksidePOS') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'MLPCare'), 8, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL-JAR)'
where (select id from public.musteriler where musteri = 'MLPCare') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Vascomm'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Vendlink (MDB)'
where (select id from public.musteriler where musteri = 'Vascomm') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Aktive Otomat'), null, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Vendlink (MDB)'
where (select id from public.musteriler where musteri = 'Aktive Otomat') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Integra Sistem (7A Bilişim)'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Integra Sistem (7A Bilişim)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Pem Enerji'), null, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Pem Enerji') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Ata Üni.'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Ata Üni.') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Wat Mobilite (Koç)'), null, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Wat Mobilite (Koç)') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Kalyon'), null, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Kalyon') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Birikim Bilgisayar'), 3, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Birikim Bilgisayar') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Rotawatt'), 2, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Rotawatt') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Velmor'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Velmor') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Suffatech'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Suffatech') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Obinova'), 3, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Obinova') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Electroop'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Electroop') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Fling Photo Studio'), 8, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Fling Photo Studio') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Beltaş'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Beltaş') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Anttech'), 3, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Anttech') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'TDV'), 8, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (JAR)'
where (select id from public.musteriler where musteri = 'TDV') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'TechoPark'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'TechoPark') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Microsoft Dynamics'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Microsoft Dynamics') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Mergen Yazılım'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Mergen Yazılım') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Missha Kozmetik'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)'
where (select id from public.musteriler where musteri = 'Missha Kozmetik') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Faturamatik'), 5, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Faturamatik') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = 'Fastsell Yazılım'), 3, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = 'Fastsell Yazılım') is not null
on conflict (musteri_id) do nothing;

insert into public.musteri_pipeline (musteri_id, aktif_faz_no, durum, owner, baslangic_tarihi, notlar)
select (select id from public.musteriler where musteri = '312 POS Yazılım'), 3, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', current_date, 'Jira board senkronizasyonu (2026-09-03)'
where (select id from public.musteriler where musteri = '312 POS Yazılım') is not null
on conflict (musteri_id) do nothing;

-- 3) Yeni eklenen firmalar için aktivite log (pipeline_eventleri)
insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'POS AŞ (Toshiba)'), 10, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'POS AŞ (Toshiba)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'NTTData'), 10, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'NTTData') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Menulux'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (JAR)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Menulux') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'ESKİ'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'ESKİ') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'EvsePOS'), 11, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'EvsePOS') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Ditravo'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (JAR)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Ditravo') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Serim Yazılım'), 14, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Serim Yazılım') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Phoenix'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Phoenix') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Assist Yazılım (Nebim Bayi)'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Assist Yazılım (Nebim Bayi)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Oxivo'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Oxivo') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Siber Teknoloji'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Siber Teknoloji') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Tepe Bİlişim'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Tepe Bİlişim') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'RPS Otomasyon'), 10, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'RPS Otomasyon') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Platforta'), 10, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Platforta') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Neftgen'), 10, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Neftgen') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'BinBin Scooter (in-house)'), 10, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'BinBin Scooter (in-house)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Diana Travel'), 14, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Diana Travel') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Otomat360 (Serpet Otomasyon)'), 8, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Vendlink (MDB)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Otomat360 (Serpet Otomasyon)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Pomsan'), 8, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Harici Cihaz P. (RS232)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Pomsan') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Bilecik Bel. (in-house)'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Bilecik Bel. (in-house)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Kaner Group (in-house)'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Kaner Group (in-house)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'TaksidePOS'), 14, 'note_added'::public.pipeline_event_type_enum, 'Tamamlandı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'TaksidePOS') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'MLPCare'), 8, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL-JAR)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'MLPCare') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Vascomm'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Vendlink (MDB)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Vascomm') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Aktive Otomat'), null, 'note_added'::public.pipeline_event_type_enum, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: Vendlink (MDB)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Aktive Otomat') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Integra Sistem (7A Bilişim)'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Integra Sistem (7A Bilişim)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Pem Enerji'), null, 'note_added'::public.pipeline_event_type_enum, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Pem Enerji') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Ata Üni.'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Ata Üni.') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Wat Mobilite (Koç)'), null, 'note_added'::public.pipeline_event_type_enum, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Wat Mobilite (Koç)') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Kalyon'), null, 'note_added'::public.pipeline_event_type_enum, 'Başlamadı'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Kalyon') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Birikim Bilgisayar'), 3, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Birikim Bilgisayar') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Rotawatt'), 2, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Rotawatt') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Velmor'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Velmor') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Suffatech'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Suffatech') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Obinova'), 3, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Obinova') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Electroop'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Electroop') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Fling Photo Studio'), 8, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Fling Photo Studio') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Beltaş'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Beltaş') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Anttech'), 3, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Anttech') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'TDV'), 8, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (JAR)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'TDV') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'TechoPark'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'TechoPark') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Microsoft Dynamics'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Microsoft Dynamics') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Mergen Yazılım'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Mergen Yazılım') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Missha Kozmetik'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03) | Ent. Tipi: PCP (DLL)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Missha Kozmetik') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Faturamatik'), 5, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Faturamatik') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = 'Fastsell Yazılım'), 3, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = 'Fastsell Yazılım') is not null;

insert into public.pipeline_eventleri (musteri_id, faz_no, event_type, durum, owner, notlar, created_by, owner_user_id, activity_scope)
select (select id from public.musteriler where musteri = '312 POS Yazılım'), 3, 'note_added'::public.pipeline_event_type_enum, 'Devam Ediyor'::public.faz_durum_enum, 'Taha Bitim', 'Jira board senkronizasyonu (2026-09-03)', 'Taha Bitim', '65bb133c-1bab-4050-bff7-2765469b7787', 'account'
where (select id from public.musteriler where musteri = '312 POS Yazılım') is not null;
