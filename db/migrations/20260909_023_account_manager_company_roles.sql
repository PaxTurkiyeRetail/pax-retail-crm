-- Account Manager kullanıcıları kendi müşterilerinde firma rollerini,
-- iş ortağı türünü ve entegrasyon süreci yeteneğini yönetebilir.
-- Kaynak sahipliği sınırı API tarafında customer.update.own ile korunur.

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select 'account_manager', 'customer.classification.manage', true
where exists (
  select 1 from public.rbac_roles where role_key = 'account_manager' and is_active = true
)
and exists (
  select 1 from public.rbac_permissions where permission_key = 'customer.classification.manage'
)
on conflict (role_key, permission_key) do update
set granted = true,
    updated_at = now();
