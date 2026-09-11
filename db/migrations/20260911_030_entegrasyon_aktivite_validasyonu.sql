-- Entegrasyon yeteneği / süreç kontrolü yalnız Entegrasyon Süreci aktivitesine aittir.
-- Teknik ve diğer aktiviteler firma tipi nedeniyle entegrasyon validasyonuna takılmamalıdır.
create or replace function public.validate_activity_context_phase() returns trigger language plpgsql as $fn$
declare
  effective_context text;
  phase_exists boolean;
  context_allowed boolean;
  integration_activity boolean;
begin
  if new.faz_no is null then return new; end if;

  effective_context := new.activity_context;
  if effective_context is null then
    select case when customer_type = 'business_partner' then 'business_partner' else 'customer' end
      into effective_context
      from public.musteriler
      where id = new.musteri_id;
    new.activity_context := effective_context;
  end if;
  integration_activity := coalesce(new.aksiyon, '') in (
    'AKTIVITE:Entegrasyon Süreci',
    'AKTIVITE:İş Ortaklığı Aktivitesi'
  );

  if integration_activity then
    select coalesce(m.integration_enabled, false)
      into context_allowed
      from public.musteriler m
      where m.id = new.musteri_id;

    -- Entegrasyon yeteneği sonradan kapatılsa bile mevcut entegrasyon kaydı düzenlenebilir.
    if tg_op = 'UPDATE'
      and old.activity_context = 'business_partner'
      and coalesce(old.aksiyon, '') in ('AKTIVITE:Entegrasyon Süreci', 'AKTIVITE:İş Ortaklığı Aktivitesi') then
      context_allowed := true;
    end if;
  else
    context_allowed := true;
  end if;

  if not coalesce(context_allowed, false) then
    raise exception 'Firma % için Entegrasyon Süreci yeteneği açık değil', new.musteri_id using errcode = '23514';
  end if;

  if effective_context = 'business_partner' then
    select exists(select 1 from public.is_ortagi_faz_tanimlari where faz_no = new.faz_no and is_active) into phase_exists;
  else
    select exists(select 1 from public.faz_tanimlari where faz_no = new.faz_no) into phase_exists;
  end if;

  if not phase_exists then
    raise exception 'Seçilen faz aktivite kapsamına ait değil' using errcode = '23514';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_validate_activity_context_phase on public.pipeline_eventleri;
create trigger trg_validate_activity_context_phase
before insert or update of musteri_id, faz_no, activity_context, aksiyon
on public.pipeline_eventleri
for each row execute function public.validate_activity_context_phase();
