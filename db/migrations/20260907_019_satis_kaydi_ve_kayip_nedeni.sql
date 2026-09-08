-- 20260907_019_satis_kaydi_ve_kayip_nedeni.sql
-- Teklif → SATIŞ dönüşümü (Sinan, 07.09.2026; Çağdaş Bey'in 07.09 toplantısı:
-- "teklifi kapatması gerekiyor adamın: ya kaybettim diyecek ya satışa dönüştürdüm").
--
-- MODEL (Sinan'ın tarifi):
--   * Teklif KAPANDIĞINDA (kazanıldı) ondan türeyen bir SATIŞ kaydı açılır.
--   * TEKLİF DONMUŞ BELGEDİR — satış düzenlense bile teklif satırları/tutarı değişmez;
--     teklif listesinde durum rengiyle durmaya devam eder (yeşil satış · turuncu bekleme
--     · kırmızı süresi dolmuş).
--   * SATIŞ DÜZENLENEBİLİR: cihaz adedi değişebilir; tutar 28.08.2026 katalog
--     kademesinden yeniden hesaplanır, istenirse "anlaşma fiyatı" ile elle ezilir
--     (price_source = 'catalog' | 'manual').
--   * Ciro tanımı tek kaynak olarak SATIŞ kaydına taşınır: teklif kazanıldı işaretlenip
--     satış kaydı açılmadıysa ciro yazmaz; düzenlenen adet/tutar panoya birebir yansır.
--     Hiç düzenleme yapılmazsa tutar teklifle aynı → eski rakamlar birebir korunur.
--   * İptal edilen satış (status='cancelled') ciroya girmez ama kayıt silinmez.
--
-- Kayıp nedeni: serbest metin yerine Liste Yönetimleri'nden yönetilen liste
-- (quote_loss_reason) + zorunlu açıklama. Kayıp analizi bu kırılımdan çıkar.
--
-- Dosya idempotenttir.

-- ---------------------------------------------------------------------------
-- 1) Satış kaydı
-- ---------------------------------------------------------------------------
create table if not exists public.crm_sales (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  customer_id uuid not null references public.musteriler(id) on delete restrict,
  -- Teklifin kapandığı andaki künye bilgileri (rapor tutarlılığı için anlık kopya)
  quote_no text not null,
  owner_name text not null,
  owner_email text,
  owner_user_id text,
  sale_date date not null default (now() at time zone 'Europe/Istanbul')::date,
  device_count integer not null default 0 check (device_count >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'USD',
  -- 'catalog' = tutar katalog kademesinden hesaplandı · 'manual' = anlaşma fiyatı elle girildi
  price_source text not null default 'catalog' check (price_source in ('catalog', 'manual')),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  note text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by text,
  created_at timestamptz not null default now(),
  created_by text,
  created_by_user_id text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint crm_sales_quote_id_key unique (quote_id)
);

create index if not exists crm_sales_customer_idx on public.crm_sales (customer_id);
create index if not exists crm_sales_owner_idx on public.crm_sales (owner_name);
create index if not exists crm_sales_sale_date_idx on public.crm_sales (sale_date);
create index if not exists crm_sales_status_idx on public.crm_sales (status);

comment on table public.crm_sales is
  'Kazanılan teklifin türevi düzenlenebilir satış kaydı. Teklif donmuş belgedir; ciro bu tablodan okunur (status=active).';
comment on column public.crm_sales.price_source is
  'catalog = quote_pricing_rules kademesinden hesaplandı · manual = anlaşma fiyatı elle girildi';

drop trigger if exists crm_sales_touch_updated_at on public.crm_sales;
create trigger crm_sales_touch_updated_at
  before update on public.crm_sales
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Mevcut kazanılmış teklifler için satış kaydı (geriye dönük doldurma)
--    Sıfırlama sonrası canlıda kazanılmış teklif kalmadıysa 0 satır ekler.
-- ---------------------------------------------------------------------------
insert into public.crm_sales
  (quote_id, customer_id, quote_no, owner_name, owner_email, owner_user_id,
   sale_date, device_count, amount, currency, price_source, status, note, created_by)
select q.id, q.customer_id, q.quote_no, q.owner_name, q.owner_email, q.owner_user_id,
       coalesce((q.closed_at at time zone 'Europe/Istanbul')::date, q.proposal_date),
       coalesce(q.total_device_count, 0), coalesce(q.total_amount, 0), 'USD', 'catalog', 'active',
       '[19 migration] Kazanılmış tekliften otomatik oluşturuldu.', 'sistem'
from public.quotes q
where q.status = 'closed' and q.closed_reason = 'won'
on conflict (quote_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Kayıp nedeni listesi (Liste Yönetimleri → Teklif)
-- ---------------------------------------------------------------------------
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('quote_loss_reason', 'price',            'Fiyat',                      'Fiyat',                      10, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'competitor',       'Rakip kazandı',              'Rakip kazandı',              20, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'no_budget',        'Bütçe yok / ertelendi',      'Bütçe yok / ertelendi',      30, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'timing',           'Zamanlama uygun değil',      'Zamanlama uygun değil',      40, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'technical',        'Teknik yetersizlik / uyumsuzluk', 'Teknik yetersizlik / uyumsuzluk', 50, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'no_decision',      'Karar alınmadı / iletişim koptu', 'Karar alınmadı / iletişim koptu', 60, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'integration',      'Entegrasyon / kasa yazılımı engeli', 'Entegrasyon / kasa yazılımı engeli', 70, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb),
  ('quote_loss_reason', 'other',            'Diğer',                      'Diğer',                      80, '{"source":"manual","module":"Teklif","category":"Ticari Politika"}'::jsonb)
on conflict (group_key, param_key) do update
  set label = excluded.label, value = excluded.value, sort_order = excluded.sort_order,
      meta = excluded.meta, is_active = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 4) Kayıp nedeni ve kapanış notu teklifte de saklanır (rapor kırılımı için)
-- ---------------------------------------------------------------------------
alter table public.quotes add column if not exists loss_reason_key text;
alter table public.quotes add column if not exists close_note text;
comment on column public.quotes.loss_reason_key is
  'quote_loss_reason parametre anahtarı (kaybedilen teklifler için). closed_reason teknik durum, bu iş nedeni.';
