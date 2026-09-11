-- 20260911_030_satis_kalemleri.sql
-- SATIŞ KALEMLERİ (crm_sale_items) — Çağdaş Bey, 11.09.2026 toplantısı:
--   "Bunun altta kalemler olmalı… Teklif gibi düşün ya. Ürün seçtik, satır ekledik.
--    Birine A80 giriyoruz, ötekine A6650. Aynı gün aynı firma olanlar tek fatura, tek satış."
--
-- BUGÜNKÜ DURUM: `crm_sales` düz bir satırdır (device_count + amount); hangi modelden kaç
-- adet satıldığı yalnız notta metin olarak duruyordu. Canlı Ekran'ın kişi slaytında istenen
-- "model bazlı cihaz kırılımı (satış / kiralama)" ve satış detayında istenen kalem listesi
-- bu tablo olmadan üretilemez.
--
-- KARARLAR:
--   * Kalem tablosu tek kaynaktır: cihaz adedi ve model kırılımı BURADAN okunur. `crm_sales`
--     üzerindeki `device_count` / `amount` özet olarak kalır (geri uyumluluk + ciro tanımı
--     değişmesin diye) ve kalemlerle tutarlı tutulur.
--   * `source='quote'` satışların kalemleri teklifin kalemlerinden (quote_items) kopyalanır.
--     Teklif donmuş belgedir; kopya satışa aittir, sonradan satış düzenlenince teklif değişmez.
--   * İçe aktarılan (Furkan'ın pivot Excel'i, 028) satışlar AYNI GÜN + AYNI FİRMA + AYNI KANAL
--     kuralıyla tek satışa birleştirilir; her model bir kalem olur. Aynı model aynı birim
--     fiyatla iki kez geçiyorsa tek kalemde toplanır (fatura mantığı).
--   * Elle girilmiş eski doğrudan satışların kalemi yoktur; ekranda "kalem girilmemiş" görünür,
--     veri uydurulmaz.
--
-- Dosya idempotenttir (tekrar çalıştırmak mükerrer kalem ya da ikinci birleştirme üretmez).

-- ---------------------------------------------------------------------------
-- 1) Kalem tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.crm_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.crm_sales(id) on delete cascade,
  line_no integer not null default 1,
  -- Katalog bağı (Ürün & Fiyat Yönetimi). Katalogda karşılığı olmayan eski kalemde null olabilir.
  product_id uuid references public.quote_products(id) on delete set null,
  -- Satış anındaki kopya: katalog sonradan değişse de fatura satırı değişmez.
  product_code text not null,
  product_name text,
  product_type text not null default 'device',
  is_recurring boolean not null default false,
  quantity integer not null check (quantity > 0),
  sale_type text not null default 'sale',
  unit_price numeric(14,2) not null default 0,
  total_price numeric(14,2) not null default 0,
  rental_monthly_price numeric(14,2),
  rental_start_date date,
  rental_end_date date,
  created_at timestamptz not null default now(),
  constraint crm_sale_items_sale_type_check check (sale_type in ('sale', 'rental'))
);

create index if not exists crm_sale_items_sale_idx on public.crm_sale_items (sale_id);
create index if not exists crm_sale_items_code_idx on public.crm_sale_items (upper(product_code));

comment on table public.crm_sale_items is
  'Satış kalemleri (fatura satırları). Model bazlı cihaz kırılımı ve satış detayı buradan okunur; crm_sales özet satırdır.';
comment on column public.crm_sale_items.sale_type is
  'sale = satın alma · rental = kiralama. Canlı Ekran model kırılımı bu alana göre satılan / kiralanan ayırır.';

-- Cihaz sayılan kalemler (hizmet/aylık kalemler cihaz adedine girmez) — tek tanım.
create or replace function public.crm_sale_item_is_device(p_product_type text, p_is_recurring boolean)
returns boolean language sql immutable as $$
  select coalesce(p_is_recurring, false) = false
     and coalesce(p_product_type, 'device') in ('device', 'peripheral', 'bundle')
$$;

-- ---------------------------------------------------------------------------
-- 2) Teklife bağlı satışlar: kalemler teklifin kalemlerinden kopyalanır
-- ---------------------------------------------------------------------------
insert into public.crm_sale_items (
  sale_id, line_no, product_id, product_code, product_name, product_type, is_recurring,
  quantity, sale_type, unit_price, total_price, rental_monthly_price, rental_start_date, rental_end_date
)
select s.id,
       row_number() over (partition by s.id order by qi.line_no, qi.id),
       qi.product_id,
       coalesce(nullif(trim(p.code), ''), 'BILINMIYOR'),
       coalesce(nullif(trim(p.name), ''), nullif(trim(p.code), '')),
       coalesce(nullif(trim(qi.product_type), ''), 'device'),
       coalesce(qi.is_recurring, false),
       greatest(1, coalesce(qi.quantity, 0)),
       case when qi.sale_type = 'rental' then 'rental' else 'sale' end,
       coalesce(qi.unit_price, 0),
       coalesce(qi.total_price, coalesce(qi.unit_price, 0) * coalesce(qi.quantity, 0)),
       qi.rental_monthly_price,
       qi.rental_start_date,
       qi.rental_end_date
from public.crm_sales s
join public.quote_items qi on qi.quote_id = s.quote_id
left join public.quote_products p on p.id = qi.product_id
where s.source = 'quote'
  and coalesce(qi.quantity, 0) > 0
  and not exists (select 1 from public.crm_sale_items i where i.sale_id = s.id);

-- ---------------------------------------------------------------------------
-- 3) İçe aktarılan satışlar: aynı gün + aynı firma + aynı kanal → tek satış
--    Pivot satırları önce hedef satışa taşınır, fazla satış kayıtları sonra silinir.
-- ---------------------------------------------------------------------------
do $$
declare
  v_merged int := 0;
  v_dropped int := 0;
begin
  -- 3a) Her grup için korunacak satış: en eski oluşturulan (id ile kararlı).
  create temporary table tmp_pivot_groups on commit drop as
  select p.customer_id, p.sale_date, p.sales_channel,
         (array_agg(s.id order by s.created_at, s.id))[1] as keep_sale_id,
         count(distinct s.id) as sale_count
  from public.crm_sales_import_pivot p
  join public.crm_sales s on s.id = p.sale_id
  where p.sale_id is not null
    and s.created_by like 'import:satis-pivot-%'
  group by p.customer_id, p.sale_date, p.sales_channel;

  -- 3b) Pivot satırlarını korunan satışa bağla.
  update public.crm_sales_import_pivot p
  set sale_id = g.keep_sale_id
  from tmp_pivot_groups g
  where p.customer_id = g.customer_id and p.sale_date = g.sale_date
    and p.sales_channel = g.sales_channel and p.sale_id is distinct from g.keep_sale_id
    and p.sale_id is not null;
  get diagnostics v_merged = row_count;

  -- 3c) Artık hiçbir pivot satırının işaret etmediği içe aktarım satışları silinir.
  delete from public.crm_sales s
  where s.created_by like 'import:satis-pivot-%'
    and not exists (select 1 from public.crm_sales_import_pivot p where p.sale_id = s.id);
  get diagnostics v_dropped = row_count;

  raise notice 'Satış birleştirme: % pivot satırı taşındı, % mükerrer satış kaydı silindi.', v_merged, v_dropped;
end $$;

-- ---------------------------------------------------------------------------
-- 4) İçe aktarılan satışların kalemleri (model × adet) + özet alanların tazelenmesi
-- ---------------------------------------------------------------------------
insert into public.crm_sale_items (
  sale_id, line_no, product_id, product_code, product_name, product_type, is_recurring,
  quantity, sale_type, unit_price, total_price
)
select g.sale_id,
       row_number() over (partition by g.sale_id order by g.qty desc, g.code),
       pr.id,
       g.code,
       coalesce(pr.name, g.code),
       coalesce(pr.product_type, 'device'),
       false,
       g.qty,
       'sale',
       g.unit_price,
       g.amount
from (
  select p.sale_id,
         upper(trim(split_part(p.models, '×', 1))) as code,
         coalesce(p.unit_price, 0) as unit_price,
         sum(p.device_count)::int as qty,
         sum(p.amount) as amount
  from public.crm_sales_import_pivot p
  where p.sale_id is not null and p.device_count > 0
  group by 1, 2, 3
) g
left join public.quote_products pr on upper(trim(pr.code)) = g.code
where not exists (select 1 from public.crm_sale_items i where i.sale_id = g.sale_id);

-- Birleştirme sonrası satış başlığı kalemlerle tutarlı olmalı (adet, tutar, not).
update public.crm_sales s
set device_count = t.devices,
    amount = t.amount,
    hardware_amount = t.amount,
    note = t.models || ' · kaynak: Satış Pivot Listesi 10.09.2026',
    updated_at = now()
from (
  select i.sale_id,
         sum(i.quantity)::int as devices,
         sum(i.total_price) as amount,
         string_agg(i.product_code || ' × ' || i.quantity, ' · ' order by i.line_no) as models
  from public.crm_sale_items i
  group by i.sale_id
) t
where s.id = t.sale_id
  and s.created_by like 'import:satis-pivot-%';

-- ---------------------------------------------------------------------------
-- 5) Bekleyen pivot satırlarının aktarımı — tek fonksiyon (elle eşleme sonrası çağrılır)
--    `select public.crm_import_pivot_to_sales();`
--    Aynı gün + aynı firma + aynı kanal satırları TEK satış + kalemler olarak yazar.
-- ---------------------------------------------------------------------------
create or replace function public.crm_import_pivot_to_sales()
returns integer
language plpgsql
as $$
declare
  g record;
  v_owner text;
  v_owner_id uuid;
  v_sale uuid;
  v_count int := 0;
begin
  for g in
    select p.customer_id, p.sale_date, p.sales_channel,
           sum(p.device_count)::int as devices,
           sum(p.amount) as amount,
           nullif(trim(m.sorumlu), '') as sorumlu
    from public.crm_sales_import_pivot p
    join public.musteriler m on m.id = p.customer_id
    where p.sale_id is null
    group by p.customer_id, p.sale_date, p.sales_channel, nullif(trim(m.sorumlu), '')
    order by p.sale_date
  loop
    v_owner := coalesce(g.sorumlu, 'Havuz Account');
    select u.id into v_owner_id
    from public.allowed_users u
    where u.is_active = true
      and lower(coalesce(nullif(trim(u.full_name), ''), u.email)) = lower(v_owner)
    limit 1;

    insert into public.crm_sales (
      quote_id, quote_no, source, customer_id, owner_name, owner_user_id,
      sale_date, device_count, amount, hardware_amount, sale_type,
      rental_monthly_amount, currency, price_source, status, sales_channel, note,
      created_by, updated_by
    ) values (
      null, null, 'direct', g.customer_id, v_owner, v_owner_id::text,
      g.sale_date, g.devices, g.amount, g.amount, 'sale',
      0, 'USD', 'manual', 'active', g.sales_channel, 'kaynak: Satış Pivot Listesi 10.09.2026',
      'import:satis-pivot-10.09.2026', 'import:satis-pivot-10.09.2026'
    )
    returning id into v_sale;

    update public.crm_sales_import_pivot p
    set sale_id = v_sale
    where p.sale_id is null and p.customer_id = g.customer_id
      and p.sale_date = g.sale_date and p.sales_channel = g.sales_channel;

    insert into public.crm_sale_items (
      sale_id, line_no, product_id, product_code, product_name, product_type, is_recurring,
      quantity, sale_type, unit_price, total_price
    )
    select v_sale,
           row_number() over (order by x.qty desc, x.code),
           pr.id, x.code, coalesce(pr.name, x.code), coalesce(pr.product_type, 'device'), false,
           x.qty, 'sale', x.unit_price, x.amount
    from (
      select upper(trim(split_part(p.models, '×', 1))) as code,
             coalesce(p.unit_price, 0) as unit_price,
             sum(p.device_count)::int as qty,
             sum(p.amount) as amount
      from public.crm_sales_import_pivot p
      where p.sale_id = v_sale and p.device_count > 0
      group by 1, 2
    ) x
    left join public.quote_products pr on upper(trim(pr.code)) = x.code;

    update public.crm_sales s
    set note = coalesce((
          select string_agg(i.product_code || ' × ' || i.quantity, ' · ' order by i.line_no)
          from public.crm_sale_items i where i.sale_id = v_sale
        ), '') || ' · kaynak: Satış Pivot Listesi 10.09.2026'
    where s.id = v_sale;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

comment on function public.crm_import_pivot_to_sales() is
  'Eşleşmiş (customer_id dolu) ama henüz aktarılmamış pivot satırlarını aynı gün + aynı firma + aynı kanal kuralıyla tek satış + kalemler olarak yazar. Kaç satış açıldığını döner.';
