-- Önce db/migrations/20261026_048_kunye_mevcut_pos_sayisi.sql uygulanmalıdır.
-- NULL bilinmeyen adettir; sıfıra dönüştürülmez.
select
  m.id as musteri_id,
  m.musteri as firma_adi,
  m.sorumlu,
  m.sektor,
  k.mevcut_pos_sayisi,
  case when k.mevcut_pos_sayisi is null then 'Girilmedi' else 'Girildi' end as veri_durumu
from public.musteriler m
left join public.musteri_kunye_v2 k on k.musteri_id = m.id
order by k.mevcut_pos_sayisi desc nulls last, m.musteri;
