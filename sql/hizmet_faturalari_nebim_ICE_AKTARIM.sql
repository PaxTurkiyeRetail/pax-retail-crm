-- ===========================================================================
-- HİZMET FATURALARI — Nebim içe aktarımı (VERİ YAZAR — önce yedek al!)
-- ===========================================================================
-- Kaynak: "Nebim Hizmet Fatura Takibi" Excel'i (Sinan, 16.09.2026) — sayfa "Nebim",
--   69 satır, 13 firma, Ocak–Eylül 2026, tamamı TL ve satışçısı FURKAN KIZILKURT.
--
-- TUTAR KURALI (Sinan onayı, 16.09 — "Karma kural, düzeltilmiş"):
--   Excel'in "BİRİM FİYAT" sütunu KARMA: çoğu satırda birim fiyat, bazılarında satır toplamı.
--   Kanıt: Evkur 34.969,98 ÷ 201 adet = tam 173,98 (diğerlerinin birim fiyatı 347,96'nın yarısı,
--   yani indirimli birim); Jack & Jones Ocak 4.175,53 = 347,96 × 12 ay (yıllık toplam), aynı firma
--   Şubat'tan itibaren 347,96 yazıyor. Bu yüzden:
--     * Evkur'un 9 satırı ve Jack & Jones Ocak satırı  → sütun ZATEN TOPLAM (10 satır)
--     * diğer 59 satır                                 → tutar = adet × sütun
--   Hepsine adet × sütun uygulansaydı 9 aylık toplam 66.268.819 TL çıkıyordu (Evkur tek başına
--   7,0 milyon TL/ay). Düzeltilmiş toplam: 1.690.139,38 TL (~188 bin TL/ay).
--   Aşağıdaki tabloda TUTAR zaten hesaplanmıştır; birim fiyat = tutar ÷ adet olarak türetilmiştir
--   (tek kaynak tutardır, altın kural 17).
--
-- ÖNKOŞUL:
--   1) `npm run db:backup:predeploy`  — bu betik VERİ SİLER ve VERİ YAZAR.
--   2) migration 036 uygulanmış olmalı (aynı fatura no birden çok firmayı kapsayabilsin).
--   3) Önce `sql/hizmet_faturalari_nebim_RAPOR.sql` çalıştırılıp eşleşmeyen firma
--      kalmadığı görülmüş olmalı — eşleşmeyen firmalar SESSİZCE ATLANIR, uydurulmaz.
--
-- SİLME (Sinan kararı 16.09: "Test kayıtlarını sil, Excel'i içe aktar"):
--   created_by <> 'nebim-import-2026' olan TÜM hizmet faturası kayıtları silinir
--   (ekrandaki SUWEN · 500 adet · $4.000 test satırı dahil). Kalemler cascade ile gider.
--
-- İDEMPOTENT: aynı (firma, dönem) için 'nebim-import-2026' kaydı varsa yeniden eklenmez;
--   betik ikinci kez çalıştırılırsa 0 satır ekler (altın kural 28).
--
-- Kullanım:  psql "$DATABASE_URL" -P pager=off -f sql/hizmet_faturalari_nebim_ICE_AKTARIM.sql
-- ===========================================================================

\set ON_ERROR_STOP on
begin;

-- Önkoşul kontrolü: migration 036 uygulanmış mı?
do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'crm_service_invoices_no_customer_active_uniq') then
    raise exception 'ONKOSUL EKSIK: migration 036 uygulanmamis. Once "npm run db:migrate" calistirin.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0) Kaynak veri (geçici tablo) — Excel'in birebir kopyası, tutarı hesaplanmış
-- ---------------------------------------------------------------------------
create temp table nebim_src (
  period_month   date          not null,
  firma          text          not null,
  adet           integer       not null,
  birim_fiyat    numeric(14,2) not null,
  toplam         numeric(14,2) not null,
  fatura_no      text          not null,
  fatura_tarihi  date          not null,
  odeme_donemi   text          not null
);

insert into nebim_src (period_month, firma, adet, birim_fiyat, toplam, fatura_no, fatura_tarihi, odeme_donemi) values
    ('2026-01-01'::date, 'Çift Geyik Karaca', 69, 347.96, 24009.24, 'PSX2026000000002', '2026-01-31'::date, 'Aylık'),
    ('2026-01-01'::date, 'Jack & Jones', 4, 1043.88, 4175.53, 'PSX2026000000002', '2026-01-31'::date, 'Yıllık'),
    ('2026-01-01'::date, 'Evkur', 201, 173.98, 34969.98, 'PSX2026000000002', '2026-01-31'::date, '6 Aylık'),
    ('2026-01-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PSX2026000000002', '2026-01-31'::date, 'Yıllık'),
    ('2026-02-01'::date, 'Çift Geyik Karaca', 69, 347.96, 24009.24, 'PXS2026000000038', '2026-02-06'::date, 'Aylık'),
    ('2026-02-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000038', '2026-02-06'::date, 'Yıllık'),
    ('2026-02-01'::date, 'Evkur', 201, 173.98, 34969.98, 'PXS2026000000038', '2026-02-06'::date, '6 Aylık'),
    ('2026-02-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000038', '2026-02-06'::date, 'Yıllık'),
    ('2026-03-01'::date, 'Çift Geyik Karaca', 69, 355.71, 24543.99, 'PXS2026000000103', '2026-03-31'::date, 'Aylık'),
    ('2026-03-01'::date, 'Yargıcı', 20, 355.71, 7114.20, 'PXS2026000000103', '2026-03-31'::date, 'Aylık'),
    ('2026-03-01'::date, 'Marka Park', 18, 355.71, 6402.78, 'PXS2026000000103', '2026-03-31'::date, 'Aylık'),
    ('2026-03-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000103', '2026-03-31'::date, 'Yıllık'),
    ('2026-03-01'::date, 'Evkur', 201, 173.98, 34969.98, 'PXS2026000000103', '2026-03-31'::date, '6 Aylık'),
    ('2026-03-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000103', '2026-03-31'::date, 'Yıllık'),
    ('2026-04-01'::date, 'Çift Geyik Karaca', 69, 355.71, 24543.99, 'PXS2026000000120', '2026-04-07'::date, 'Aylık'),
    ('2026-04-01'::date, 'Yargıcı', 20, 355.71, 7114.20, 'PXS2026000000120', '2026-04-07'::date, 'Aylık'),
    ('2026-04-01'::date, 'Marka Park', 18, 355.71, 6402.78, 'PXS2026000000120', '2026-04-07'::date, 'Aylık'),
    ('2026-04-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000120', '2026-04-07'::date, 'Yıllık'),
    ('2026-04-01'::date, 'Evkur', 201, 173.98, 34969.98, 'PXS2026000000120', '2026-04-07'::date, '6 Aylık'),
    ('2026-04-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000120', '2026-04-07'::date, 'Yıllık'),
    ('2026-05-01'::date, 'Çift Geyik Karaca', 69, 361.72, 24958.68, 'PXS2026000000172', '2026-05-07'::date, 'Aylık'),
    ('2026-05-01'::date, 'Kiğılı', 100, 293.90, 29389.95, 'PXS2026000000172', '2026-05-07'::date, 'Aylık'),
    ('2026-05-01'::date, 'Yargıcı', 20, 361.72, 7234.40, 'PXS2026000000172', '2026-05-07'::date, 'Aylık'),
    ('2026-05-01'::date, 'Marka Park', 18, 361.72, 6510.96, 'PXS2026000000172', '2026-05-07'::date, 'Aylık'),
    ('2026-05-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000172', '2026-05-07'::date, 'Yıllık'),
    ('2026-05-01'::date, 'Evkur', 201, 173.98, 34969.98, 'PXS2026000000172', '2026-05-07'::date, '6 Aylık'),
    ('2026-05-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000172', '2026-05-07'::date, 'Yıllık'),
    ('2026-06-01'::date, 'Çift Geyik Karaca', 69, 368.77, 25445.13, 'PXS2026000000205', '2026-06-09'::date, 'Aylık'),
    ('2026-06-01'::date, 'Kiğılı', 302, 299.63, 90488.26, 'PXS2026000000205', '2026-06-09'::date, 'Aylık'),
    ('2026-06-01'::date, 'B&G Store', 30, 368.77, 11063.10, 'PXS2026000000205', '2026-06-09'::date, 'Aylık'),
    ('2026-06-01'::date, 'Yargıcı', 27, 368.77, 9956.79, 'PXS2026000000205', '2026-06-09'::date, 'Aylık'),
    ('2026-06-01'::date, 'Marka Park', 18, 368.77, 6637.86, 'PXS2026000000205', '2026-06-09'::date, 'Aylık'),
    ('2026-06-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000205', '2026-06-09'::date, 'Yıllık'),
    ('2026-06-01'::date, 'Evkur', 201, 173.98, 34969.98, 'PXS2026000000205', '2026-06-09'::date, '6 Aylık'),
    ('2026-06-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000205', '2026-06-09'::date, 'Yıllık'),
    ('2026-07-01'::date, 'Çift Geyik Karaca', 69, 347.84, 24000.96, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'İpekyol', 260, 327.98, 85274.80, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'Kiğılı', 302, 304.55, 91974.10, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'B&G Store', 30, 347.84, 10435.20, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'Naramaxx', 44, 347.84, 15304.96, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'Yargıcı', 27, 347.84, 9391.68, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'Marka Park', 18, 347.84, 6261.12, 'PXS2026000000247', '2026-07-09'::date, 'Aylık'),
    ('2026-07-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000247', '2026-07-09'::date, 'Yıllık'),
    ('2026-07-01'::date, 'Evkur', 201, 187.41, 37670.29, 'PXS2026000000247', '2026-07-09'::date, '6 Aylık'),
    ('2026-07-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000247', '2026-07-09'::date, 'Yıllık'),
    ('2026-08-01'::date, 'Çift Geyik Karaca', 69, 382.17, 26369.73, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'İpekyol', 260, 334.40, 86944.00, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Kiğılı', 302, 310.52, 93777.04, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Simkoza Mağazacılık', 25, 382.17, 9554.25, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Mad Parfüm', 183, 382.17, 69937.11, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'B&G Store', 33, 382.17, 12611.61, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Naramaxx', 44, 382.17, 16815.48, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Yargıcı', 31, 382.17, 11847.27, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Marka Park', 18, 382.17, 6879.06, 'PXS2026000000297', '2026-08-14'::date, 'Aylık'),
    ('2026-08-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000297', '2026-08-14'::date, 'Yıllık'),
    ('2026-08-01'::date, 'Evkur', 201, 187.41, 37670.29, 'PXS2026000000297', '2026-08-14'::date, '6 Aylık'),
    ('2026-08-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000297', '2026-08-14'::date, 'Yıllık'),
    ('2026-09-01'::date, 'Çift Geyik Karaca', 95, 387.47, 36809.65, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'İpekyol', 280, 339.04, 94931.20, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Suwen', 134, 387.47, 51920.98, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Kiğılı', 302, 314.82, 95075.64, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Simkoza Mağazacılık', 24, 387.47, 9299.28, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Mad Parfüm', 255, 387.47, 98804.85, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'B&G Store', 33, 387.47, 12786.51, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Naramaxx', 44, 387.47, 17048.68, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Yargıcı', 49, 387.47, 18986.03, 'PXS2026000000025', '2026-09-01'::date, 'Aylık'),
    ('2026-09-01'::date, 'Jack & Jones', 4, 347.96, 1391.84, 'PXS2026000000025', '2026-09-01'::date, 'Yıllık'),
    ('2026-09-01'::date, 'Evkur', 201, 187.41, 37670.29, 'PXS2026000000025', '2026-09-01'::date, '6 Aylık'),
    ('2026-09-01'::date, 'Sınırlı Sorumlu', 1, 347.96, 347.96, 'PXS2026000000025', '2026-09-01'::date, 'Yıllık');

-- ---------------------------------------------------------------------------
-- 1) Firma eşleştirme — önce birebir ad anahtarı, sonra İÇERME (tek aday şartıyla)
--    crm_firma_key(): migration 035'ten gelir (büyük harf + Türkçe sadeleştirme + yalnız A-Z0-9).
-- ---------------------------------------------------------------------------
create temp table nebim_map as
with kaynak as (select distinct firma from nebim_src),
birebir as (
  select k.firma, (array_agg(m.id order by m.id))[1] as customer_id, count(*) as aday
  from kaynak k
  join public.musteriler m on public.crm_firma_key(m.musteri) = public.crm_firma_key(k.firma)
  group by k.firma
),
icerme as (
  select k.firma, (array_agg(m.id order by m.id))[1] as customer_id, count(*) as aday
  from kaynak k
  join public.musteriler m
    on length(public.crm_firma_key(k.firma)) >= 7
   and position(public.crm_firma_key(k.firma) in public.crm_firma_key(m.musteri)) > 0
  where k.firma not in (select firma from birebir where aday = 1)
  group by k.firma
)
select k.firma,
       coalesce(b.customer_id, case when i.aday = 1 then i.customer_id end) as customer_id,
       case when b.aday = 1 then 'birebir'
            when i.aday = 1 then 'icerme'
            when b.aday > 1 then 'COKLU-ADAY-birebir'
            when i.aday > 1 then 'COKLU-ADAY-icerme'
            else 'ESLESMEDI' end as yontem
from kaynak k
left join birebir b on b.firma = k.firma and b.aday = 1
left join icerme  i on i.firma = k.firma;


-- ---------------------------------------------------------------------------
-- 2) Satışçı — Excel'in tamamında FURKAN KIZILKURT yazıyor
-- ---------------------------------------------------------------------------
create temp table satisci (ad text, user_id text);
insert into satisci (ad, user_id)
select coalesce(nullif(trim(u.full_name), ''), u.email), u.id::text
from public.allowed_users u
where u.is_active = true and lower(coalesce(u.full_name, u.email)) like '%furkan%'
order by u.id limit 1;
-- Kullanıcı bulunamazsa ad yazıyla korunur (gizlice başka satışçıya yazılmaz)
insert into satisci (ad, user_id)
select 'Furkan Kızılkurt', null where not exists (select 1 from satisci);

\echo ''
\echo '=== 0) EŞLEŞMEYEN FİRMALAR (atlanacak) ======================================='
select n.firma, n.yontem, count(*) as satir, sum(s.toplam) as atlanan_tutar
from nebim_map n join nebim_src s on s.firma = n.firma
where n.customer_id is null group by 1,2 order by 1;

\echo ''
\echo '=== 1) SİLİNEN ESKİ/TEST KAYITLARI ==========================================='
with silinen as (
  delete from public.crm_service_invoices
  where coalesce(created_by, '') <> 'nebim-import-2026'
  returning customer_id, period_month, currency, amount, invoice_no
)
select count(*) as silinen_fatura, coalesce(sum(amount), 0) as silinen_tutar from silinen;

\echo ''
\echo '=== 2) İÇE AKTARILAN FATURALAR ==============================================='
with kaynak as (
  select s.*, n.customer_id
  from nebim_src s join nebim_map n on n.firma = s.firma
  where n.customer_id is not null
),
yeni as (
  insert into public.crm_service_invoices
    (customer_id, owner_name, owner_user_id, period_month, invoice_date, invoice_no,
     currency, amount, status, note, created_by, created_by_user_id, updated_by)
  select k.customer_id, o.ad, o.user_id, k.period_month, k.fatura_tarihi, k.fatura_no,
         'TRY', k.toplam, 'active',
         'Nebim hizmet fatura takibi — ödeme dönemi: ' || k.odeme_donemi,
         'nebim-import-2026', o.user_id, 'nebim-import-2026'
  from kaynak k cross join satisci o
  where not exists (
    select 1 from public.crm_service_invoices x
    where x.customer_id = k.customer_id
      and x.period_month = k.period_month
      and x.created_by = 'nebim-import-2026'
  )
  returning id, customer_id, period_month, amount
),
kalem as (
  insert into public.crm_service_invoice_items
    (invoice_id, line_no, service_key, service_label, quantity, unit_price, total_price)
  select y.id, 1, 'kasapos_entegrasyonu_tms', 'KasaPOS Entegrasyonu + TMS',
         k.adet, k.birim_fiyat, k.toplam
  from yeni y
  join kaynak k on k.customer_id = y.customer_id and k.period_month = y.period_month
  returning 1
)
select (select count(*) from yeni)  as eklenen_fatura,
       (select count(*) from kalem) as eklenen_kalem,
       (select coalesce(sum(amount), 0) from yeni) as eklenen_tutar;

-- ---------------------------------------------------------------------------
-- 3) DOĞRULAMA — beklenen ile karşılaştır
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== 3) DOĞRULAMA ============================================================='
with beklenen as (
  select count(*) as satir, sum(s.toplam) as tutar
  from nebim_src s join nebim_map n on n.firma = s.firma
  where n.customer_id is not null
),
gercek as (
  select count(*) as satir, sum(amount) as tutar
  from public.crm_service_invoices where created_by = 'nebim-import-2026' and status = 'active'
)
select b.satir as beklenen_satir, g.satir as gercek_satir,
       to_char(b.tutar, 'FM999G999G990D00') as beklenen_tutar,
       to_char(g.tutar, 'FM999G999G990D00') as gercek_tutar,
       case when b.satir = g.satir and b.tutar = g.tutar then 'TAMAM' else 'FARK VAR — İNCELE' end as sonuc
from beklenen b cross join gercek g;

\echo ''
\echo '--- kalem/başlık tutar tutarlılığı (0 satır beklenir) ---'
select i.id, m.musteri, i.amount as baslik_tutar, sum(t.total_price) as kalem_toplami
from public.crm_service_invoices i
join public.musteriler m on m.id = i.customer_id
left join public.crm_service_invoice_items t on t.invoice_id = i.id
where i.created_by = 'nebim-import-2026'
group by i.id, m.musteri, i.amount
having i.amount is distinct from coalesce(sum(t.total_price), 0);

\echo ''
\echo '--- aylık dağılım ---'
select to_char(period_month, 'YYYY-MM') as donem, count(*) as fatura,
       to_char(sum(amount), 'FM999G999G990D00') as tutar_tl
from public.crm_service_invoices
where created_by = 'nebim-import-2026' and status = 'active'
group by 1 order by 1;

\echo ''
\echo '--- entegrasyon bayrağı açılan firmalar (036 trigger''ı) ---'
select m.musteri, m.integration_enabled,
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as kunye_sorumlusu
from public.musteriler m
where m.id in (select distinct customer_id from public.crm_service_invoices where created_by = 'nebim-import-2026')
order by m.musteri;

commit;

\echo ''
\echo 'BITTI. Ekranda Operasyon > Satislar > Hizmet Faturalari sekmesini kontrol edin.'
