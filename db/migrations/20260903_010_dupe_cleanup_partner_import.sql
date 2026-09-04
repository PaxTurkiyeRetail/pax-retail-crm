-- 20260903_010_dupe_cleanup_partner_import.sql
-- 009 migration'da (Jira İş Ortakları importu) case/format farkı yüzünden mevcut
-- 11 firma tekrar eklenmişti. Bu dosya o 11 yanlış-eklenen kaydı (ve bağlı
-- pipeline/aktivite kayıtlarını) siler. Orijinal (önceden var olan) kayıtlara
-- dokunulmaz. İdempotenttir (satır yoksa DELETE 0 döner, hata vermez).
--
-- Silinen (benim yanlış eklediğim) -> zaten var olan orijinal:
--   POS AŞ (Toshiba)              -> TOSHIBA (POS AŞ)
--   Otomat360 (Serpet Otomasyon)  -> Otomat 360
--   312 POS Yazılım               -> 312POS
--   Fastsell Yazılım              -> FASTSELL
--   Obinova                       -> Obinova Teknoloji
--   Oxivo                         -> Oxivo Group
--   Serim Yazılım                 -> Serim
--   Vascomm                       -> VASCOMM BİLİŞİM
--   Pomsan                        -> Ankara Belediye Pomsan Otomat
--   Bilecik Bel. (in-house)       -> Bilecik Belediyesi
--   Beltaş                        -> Ankara Belediyesi Beltaş Otopark İşletmeciliği

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
