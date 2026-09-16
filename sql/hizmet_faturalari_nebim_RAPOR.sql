-- ===========================================================================
-- HİZMET FATURALARI — Nebim içe aktarımı ÖN RAPORU (SALT OKUNUR, hiçbir şey yazmaz)
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
-- ÖNKOŞUL: migration 036 uygulanmış olmalı (aynı fatura no birden çok firmayı kapsayabilsin diye
--   crm_service_invoices'taki benzersiz fatura-no indeksi (fatura_no, customer_id)'ye gevşetiliyor).
--
-- Kullanım:  psql "$DATABASE_URL" -P pager=off -f sql/hizmet_faturalari_nebim_RAPOR.sql
-- ===========================================================================

\set ON_ERROR_STOP on
begin;

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


\echo ''
\echo '=== A) FİRMA EŞLEŞTİRME (13 firma) ==========================================='
select n.firma                                        as excel_firma,
       coalesce(m.musteri, '— EŞLEŞMEDİ —')           as crm_musteri,
       n.yontem,
       coalesce(nullif(trim(m.sorumlu), ''), 'Havuz Account') as crm_sorumlu,
       coalesce(m.integration_enabled, false)         as entegrasyon_acik,
       ps.active_phase_no                             as is_ortagi_faz,
       case when m.id is null then '—'
            when coalesce(ps.active_phase_no, 0) >= 9 then 'gerceklesene GIRER'
            else 'faz < 9 — gerceklesene GIRMEZ' end  as dashboard_durumu
from nebim_map n
left join public.musteriler m on m.id = n.customer_id
left join public.organization_pipeline_states ps
       on ps.customer_id = m.id and ps.context_key = 'business_partner'
order by (n.customer_id is null) desc, n.firma;

\echo ''
\echo '=== B) EŞLEŞMEYEN FİRMALAR (bunlar İÇE AKTARILMAZ) ==========================='
select n.firma, n.yontem, count(*) as etkilenen_satir, sum(s.toplam) as kayip_tutar_tl
from nebim_map n join nebim_src s on s.firma = n.firma
where n.customer_id is null
group by n.firma, n.yontem order by n.firma;

\echo ''
\echo '=== C) AYLIK ÖZET (içe aktarılacak) =========================================='
select to_char(s.period_month, 'YYYY-MM')          as donem,
       count(*)                                    as satir,
       count(*) filter (where n.customer_id is null) as eslesmeyen,
       sum(s.adet)                                 as toplam_adet,
       to_char(sum(s.toplam), 'FM999G999G990D00')  as tutar_tl
from nebim_src s join nebim_map n on n.firma = s.firma
group by 1 order by 1;

\echo ''
\echo '=== D) FİRMA BAZLI ÖZET ======================================================'
select s.firma, count(*) as ay_sayisi, max(s.adet) as adet,
       to_char(sum(s.toplam), 'FM999G999G990D00') as tutar_tl,
       max(s.odeme_donemi) as odeme_donemi
from nebim_src s group by s.firma order by sum(s.toplam) desc;

\echo ''
\echo '=== E) GENEL TOPLAM =========================================================='
select count(*) as satir,
       to_char(sum(toplam), 'FM999G999G990D00') as toplam_tl,
       min(period_month) as ilk_donem, max(period_month) as son_donem
from nebim_src;

\echo ''
\echo '=== F) ŞU AN EKRANDA OLAN KAYITLAR (içe aktarımda SİLİNECEK) ================='
select coalesce(m.musteri, '?') as firma, i.owner_name as satisci,
       to_char(i.period_month, 'YYYY-MM') as donem, i.currency, i.amount,
       i.invoice_no, i.status, i.created_by
from public.crm_service_invoices i
left join public.musteriler m on m.id = i.customer_id
order by i.created_at;

\echo ''
\echo '=== G) SATIŞÇI (Furkan) allowed_users eşleşmesi =============================='
select u.id::text as user_id, coalesce(nullif(trim(u.full_name), ''), u.email) as ad, u.is_active
from public.allowed_users u
where u.is_active = true and lower(coalesce(u.full_name, u.email)) like '%furkan%';

rollback;
