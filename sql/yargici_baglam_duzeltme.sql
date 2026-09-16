-- ===========================================================================
-- YARGICI — bayat business_partner bağlamını customer bağlamına TAŞI
-- ===========================================================================
-- KAYNAK: sql/hizmet_faturalari_eksik_firmalar_RAPOR.sql §D ve
-- sql/entegrasyon_sayaci_KARSILASTIRMA.sql §D/§E (16.09.2026) ile kanıtlandı:
-- YARGICI'nın organization_pipeline_states satırı context_key='business_partner',
-- active_phase_no=24 ("Rollout" — MÜŞTERİ numarası) olarak duruyor; ama
-- organization_roles'ta business_partner rolü AKTİF DEĞİL (YARGICI gerçekte son
-- müşteri). Bu satır baseline migration 004'ün tohumlama hatasından kalma
-- (customer_type='business_partner' olan eski firmaların müşteri fazı o gün
-- business_partner bağlamına kopyalanmış).
--
-- Bu betik VERİ UYDURMAZ (altın kural 34): mevcut satırın TÜM alanlarını
-- (faz, durum, sorumlu, hedef tarih) olduğu gibi customer bağlamına TAŞIR —
-- context_key dışında hiçbir değer değişmez. İdempotenttir: satır zaten
-- customer bağlamındaysa (daha önce çalıştırılmışsa) 0 satır etkilenir.
--
-- Kullanım:
--   set -a; . ./.env.local; set +a
--   psql "$DATABASE_URL" -P pager=off -f sql/yargici_baglam_duzeltme.sql
-- ===========================================================================

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_customer_id uuid;
  v_match_count int;
  v_business_row record;
  v_customer_row_exists boolean;
  v_updated int;
begin
  select count(*) into v_match_count from public.musteriler where musteri ilike '%YARGICI%';
  if v_match_count <> 1 then
    raise exception 'Beklenmeyen eşleşme sayısı (%): isim "YARGICI" tam olarak 1 firmaya karşılık gelmeli, elle kontrol et.', v_match_count;
  end if;

  select id into v_customer_id from public.musteriler where musteri ilike '%YARGICI%';

  select * into v_business_row
  from public.organization_pipeline_states
  where customer_id = v_customer_id and context_key = 'business_partner';

  select exists(
    select 1 from public.organization_pipeline_states
    where customer_id = v_customer_id and context_key = 'customer'
  ) into v_customer_row_exists;

  if v_business_row.customer_id is null then
    raise notice 'YARGICI (%) için business_partner bağlamında satır yok — muhtemelen daha önce taşındı, yapılacak bir şey kalmadı.', v_customer_id;
    return;
  end if;

  if v_customer_row_exists then
    raise exception 'YARGICI (%) için HEM business_partner HEM customer bağlamında satır var — elle inceleme gerekiyor, otomatik taşınmadı.', v_customer_id;
  end if;

  raise notice 'TAŞINACAK SATIR: customer_id=%, faz=%, durum=%, sorumlu=%, hedef_tarih=%',
    v_business_row.customer_id, v_business_row.active_phase_no, v_business_row.status, v_business_row.owner, v_business_row.target_date;

  update public.organization_pipeline_states
  set context_key = 'customer'
  where customer_id = v_customer_id and context_key = 'business_partner';
  get diagnostics v_updated = row_count;

  raise notice 'Taşındı: % satır (business_partner -> customer).', v_updated;
end $$;

\echo ''
\echo '=== SONUÇ: YARGICI''nın güncel pipeline satırları ==========================='
select s.customer_id, s.context_key, s.active_phase_no, s.status, s.owner, s.target_date
from public.organization_pipeline_states s
join public.musteriler m on m.id = s.customer_id
where m.musteri ilike '%YARGICI%'
order by s.context_key;

commit;
