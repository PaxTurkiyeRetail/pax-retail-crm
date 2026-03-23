-- Önce müşteri pipeline kaydını son dolu event partner_owner değeriyle tamamla
update public.musteri_pipeline mp
set
  partner_owner = src.partner_owner,
  updated_at = now()
from (
  select distinct on (pe.musteri_id)
    pe.musteri_id,
    pe.partner_owner
  from public.pipeline_eventleri pe
  where pe.partner_owner is not null
    and btrim(pe.partner_owner) <> ''
  order by pe.musteri_id, pe.created_at desc
) src
where mp.musteri_id = src.musteri_id
  and (mp.partner_owner is null or btrim(mp.partner_owner) = '');

-- Sonra event kayıtlarını pipeline üzerindeki partner_owner ile doldur
update public.pipeline_eventleri pe
set partner_owner = mp.partner_owner
from public.musteri_pipeline mp
where pe.musteri_id = mp.musteri_id
  and (pe.partner_owner is null or btrim(pe.partner_owner) = '')
  and mp.partner_owner is not null
  and btrim(mp.partner_owner) <> '';
