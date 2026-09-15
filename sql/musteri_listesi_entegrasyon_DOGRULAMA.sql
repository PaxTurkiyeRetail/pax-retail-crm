-- Migration 035 SONRASI doğrulama — SALT OKUNUR. Hepsi beklenen değeriyle birlikte.
-- Çalıştırma: psql "$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2-)" -f sql/musteri_listesi_entegrasyon_DOGRULAMA.sql
select 'Liste satırı (aktif)'                    as kontrol, count(*)::text as deger, 'müşteri sayısına eşit olmalı' as beklenen from public.crm_musteri_listesi where is_active
union all select 'Müşteri (künye) sayısı', count(*)::text, 'liste satırına eşit olmalı' from public.musteriler
union all select 'Künyeye BAĞLI liste satırı', count(*)::text, 'liste satırının tamamı' from public.crm_musteri_listesi where is_active and musteri_id is not null
union all select 'Künyeye bağlanamayan satır', count(*)::text, '0 (aynı ada çok künye varsa >0 olabilir — elle bak)' from public.crm_musteri_listesi where is_active and musteri_id is null
union all select 'Listede olmayan müşteri', count(*)::text, '0' from public.musteriler m
  where not exists (select 1 from public.crm_musteri_listesi l where l.is_active and l.musteri_id = m.id)
union all select 'Sahip çelişkisi (liste ≠ künye)', count(*)::text, '0' from public.crm_musteri_listesi l
  join public.musteriler m on m.id = l.musteri_id
  where l.is_active and coalesce(m.sorumlu, 'Havuz Account') is distinct from coalesce(l.satici, 'Havuz Account')
union all select 'Kategori çelişkisi (liste ≠ etiket)', count(*)::text, '0' from public.crm_musteri_listesi l
  join public.musteri_kunye_v2 k on k.musteri_id = l.musteri_id
  where l.is_active and public.crm_etiket_to_kategori(k.satici_etiketi) is distinct from l.kategori
union all select 'Satıcı Etiketi seçenekleri', string_agg(value, ' · ' order by sort_order), 'Hunter · Farmer · Lead · Kasa'
  from public.system_parameters where group_key = 'kunye_satici_etiketi' and is_active
union all select 'Senkron trigger sayısı', count(*)::text, '3' from pg_trigger
  where tgname in ('trg_crm_liste_to_kunye', 'trg_crm_kunye_to_liste', 'trg_crm_etiket_to_liste') and not tgisinternal;
