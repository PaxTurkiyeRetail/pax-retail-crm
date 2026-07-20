-- Salt okunur CRM müşteri veri kaynağı kontrolü.
select count(*) as musteriler_table_count from public.musteriler;
select count(*) as legacy_view_count from public.vw_crm_musteriler;
select count(*) as pipeline_count from public.musteri_pipeline;

select
  m.id,
  m.musteri,
  m.sorumlu,
  mp.aktif_faz_no,
  ft.asama_adi as aktif_faz_adi
from public.musteriler m
left join public.musteri_pipeline mp on mp.musteri_id = m.id
left join public.faz_tanimlari ft on ft.faz_no = mp.aktif_faz_no
order by m.musteri
limit 20;
