-- Satışlar > Hizmet Faturaları için ek hizmet kalemleri.
-- Mevcut faturalar kendi service_key/service_label kopyalarını korur.
insert into public.system_parameters (group_key, param_key, label, value, sort_order)
values
  ('service_invoice_item', 'pax_uzaktan_yukleme_bedeli', 'PAX Uzaktan Yükleme Bedeli', 'PAX Uzaktan Yükleme Bedeli', 50),
  ('service_invoice_item', 'yazilim_gelistirme', 'Yazılım Geliştirme', 'Yazılım Geliştirme', 60),
  ('service_invoice_item', 'yazilim_test_bedeli', 'Yazılım Test Bedeli', 'Yazılım Test Bedeli', 70),
  ('service_invoice_item', 'pom_bedeli', 'POM Bedeli', 'POM Bedeli', 80),
  ('service_invoice_item', 'bkm_techpos', 'BKM TechPOS', 'BKM TechPOS', 90),
  ('service_invoice_item', 'yazilim_bakim', 'Yazılım Bakım', 'Yazılım Bakım', 100)
on conflict (group_key, param_key) do nothing;
