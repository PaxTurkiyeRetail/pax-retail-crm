-- 055: Ürün Kataloğu — account_manager ürün ekleyebilsin/düzenleyebilsin (quote.catalog.manage).
-- Idempotent. DROP/DELETE yok.

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select r.role_key, 'quote.catalog.manage', true
from (values ('account_manager')) r(role_key)
where exists (select 1 from public.rbac_roles rr where rr.role_key = r.role_key and rr.is_active = true)
  and exists (select 1 from public.rbac_permissions p where p.permission_key = 'quote.catalog.manage')
on conflict (role_key, permission_key) do update
  set granted = true, updated_at = now();
