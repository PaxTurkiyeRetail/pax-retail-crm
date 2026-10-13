-- 20261013_044_quote_manual_price.sql
-- TEKLİFTE ÖZEL BİRİM FİYAT (13.10.2026)
--
-- Katalog dışı fiyatla çalışan ekipler (account'lar) teklif satış satırında birim fiyatı elle girebilir.
-- Fiyat serbest; satır işaretlenir: price_source='manual', katalog kademe fiyatı ve giren kişi saklanır.
-- Yetki: quote.price.override → varsayılan admin + super_admin; diğer rollere RBAC ekranından verilir.
--
-- Dosya idempotenttir. Veri silmez. Mevcut satırlar 'catalog' kabul edilir.

alter table public.quote_items add column if not exists price_source text not null default 'catalog';
alter table public.quote_items add column if not exists catalog_unit_price numeric;
alter table public.quote_items add column if not exists price_set_by text;

insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('quote.price.override', 'quote', 'Teklifte özel fiyat',
   'Teklif satış satırında katalog kademesi yerine elle birim fiyat girebilme (satır "özel fiyat" olarak işaretlenir).')
on conflict (permission_key) do update
  set module_key = excluded.module_key, label = excluded.label, description = excluded.description;

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select r.role_key, 'quote.price.override', true
from (values ('admin'), ('super_admin')) r(role_key)
where exists (select 1 from public.rbac_roles rr where rr.role_key = r.role_key and rr.is_active = true)
  and exists (select 1 from public.rbac_permissions rp where rp.permission_key = 'quote.price.override')
on conflict (role_key, permission_key) do update
  set granted = true, updated_at = now();
