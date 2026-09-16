-- 20260916_036_hizmet_faturasi_entegrasyon.sql
-- HİZMET FATURASI ↔ ENTEGRASYON BAĞI + çoklu firmalı fatura numarası
--
-- KAYNAK (Sinan, 16.09.2026): "bu girilen entegrasyon kısmı için böyle bir veri girilmesine
--   rağmen Furkan için dashboardda gözükmüyor" (SUWEN · KasaPOS Entegrasyonu + TMS ekran görüntüsü).
--
-- TEŞHİS: Canlı Ekran'ın entegrasyon sayacı (`Q_INTEGRATIONS`, lib/reports/live-board.ts) hizmet
--   faturalarına HİÇ bakmıyordu; tanımı "musteriler.integration_enabled = true" + iş ortağı
--   hattındaki aktif faz ≥ 9 idi. Hizmet faturası girmek bu iki alandan hiçbirini değiştirmiyordu,
--   dolayısıyla fatura girilse de sayaç kıpırdamıyordu.
--
-- KARAR (Sinan, 16.09 — "Fatura girilince firma otomatik entegrasyon açık olsun"):
--   Bir firmaya KasaPOS entegrasyonu için fatura kesiliyorsa o firmanın entegrasyon süreci
--   fiilen açıktır. Bu yüzden aktif hizmet faturası girilen/güncellenen firmada
--   `musteriler.integration_enabled` otomatik true yapılır.
--
--   Sayacın SAHİPLİĞİ DEĞİŞMEDİ: entegrasyon yine firmanın KÜNYE SORUMLUSU'na yazılır,
--   faturadaki satışçıya değil (altın kural 17 — tanım Entegrasyon Raporu ile ortak kalır).
--   Furkan tüm firmalara fatura girdiği için, faturayı girenin panosuna yazmak başka
--   satışçıların sayısını çalardı.
--
--   TEK YÖNLÜDÜR: fatura iptal edilince bayrak geri KAPATILMAZ. Sebep: `integration_enabled`
--   başka gerekçelerle de (Taha'nın 015'i, elle işaretleme) açılmış olabilir; trigger'ın
--   başkasının verisini kapatma yetkisi yoktur.
--
-- ⚠ DASHBOARD "GERÇEKLEŞEN" NOTU: Canlı Ekran'daki entegrasyon KUTUSU `done` sayısını gösterir;
--   `done` = integration_enabled AND iş ortağı hattında aktif faz ≥ 9. Bu migration yalnız
--   `integration_enabled`i açar, yani firmalar sayacın PAYDA'sına (`total`) girer. Faz < 9 olan
--   firmalar "gerçekleşen" sayısına hâlâ girmez — faz verisi satış sürecinin kendi kaydıdır,
--   fatura girildi diye faz atlatmak sahte ilerleme üretirdi (altın kural 34: uydurma sayı yok).
--   Hangi firmaların fazının < 9 olduğu `sql/hizmet_faturalari_nebim_RAPOR.sql` §A'da listelenir;
--   fazı yükseltme kararı Sinan'ındır.
--
-- Dosya idempotenttir.

-- ---------------------------------------------------------------------------
-- 1) Fatura numarası benzersizliği: (fatura_no) → (fatura_no, customer_id)
-- ---------------------------------------------------------------------------
-- Gerçek Nebim faturası TEK numarayla BİRDEN ÇOK firmayı kapsıyor (ör. PXS2026000000025
-- Eylül'de 12 firmayı içeriyor). 032'deki indeks bir numaranın yalnız bir aktif kayıtta
-- geçmesine izin veriyordu; bu gerçek veriyi içe aktarmayı imkânsız kılıyor.
-- Yeni kural: aynı fatura numarası birden çok firmada geçebilir, AMA aynı firmada iki kez geçemez.
drop index if exists public.crm_service_invoices_no_active_uniq;

create unique index if not exists crm_service_invoices_no_customer_active_uniq
  on public.crm_service_invoices (upper(trim(invoice_no)), customer_id)
  where invoice_no is not null and status = 'active';

comment on index public.crm_service_invoices_no_customer_active_uniq is
  'Aynı fatura numarası birden çok firmayı kapsayabilir (tek Nebim faturası çok firmalı), ama aynı firmada iki kez girilemez.';

-- ---------------------------------------------------------------------------
-- 2) Hizmet faturası → entegrasyon bayrağı (tek yönlü)
-- ---------------------------------------------------------------------------
create or replace function public.crm_service_invoice_marks_integration()
returns trigger
language plpgsql
as $$
begin
  -- Yalnız aktif faturalar bayrak açar; iptal edilenler bayrağı KAPATMAZ (yukarıdaki not).
  if new.status = 'active' and new.customer_id is not null then
    update public.musteriler
       set integration_enabled = true,
           updated_at = now(),
           updated_by = 'hizmet-faturasi-trigger'
     where id = new.customer_id
       and integration_enabled is distinct from true;
  end if;
  return null;
end;
$$;

comment on function public.crm_service_invoice_marks_integration() is
  'Aktif hizmet faturası girilen firmanın entegrasyon süreci bayrağını açar (tek yönlü). Sinan kararı 16.09.2026.';

drop trigger if exists trg_crm_service_invoice_integration on public.crm_service_invoices;
create trigger trg_crm_service_invoice_integration
after insert or update of customer_id, status
on public.crm_service_invoices
for each row execute function public.crm_service_invoice_marks_integration();

-- ---------------------------------------------------------------------------
-- 3) Geriye dönük doldurma — hâlihazırdaki aktif hizmet faturaları
-- ---------------------------------------------------------------------------
update public.musteriler m
   set integration_enabled = true,
       updated_at = now(),
       updated_by = 'migration-036'
 where m.integration_enabled is distinct from true
   and exists (
     select 1 from public.crm_service_invoices i
      where i.customer_id = m.id and i.status = 'active'
   );
