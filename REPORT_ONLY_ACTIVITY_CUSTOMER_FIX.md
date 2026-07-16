# Report-only müşteri aktivite seçimi düzeltmesi

Bu patch ile Seda Kesikoğlu / Cem Koç sorumluluğundaki BANKA / VERTICAL müşterileri genel CRM ve künye ekranlarında gizli kalır; ancak teknik aktivite ekleme ekranındaki müşteri listesinden tekrar seçilebilir.

## Değişen dosyalar

- `app/api/activities/customers/route.ts`
  - Aktivite ekleme ekranına özel müşteri listesi eklendi.
  - Normal CRM müşterileri `vw_crm_musteriler` üzerinden alınır.
  - Seda Kesikoğlu / Cem Koç veya BANKA / VERTICAL müşterileri ayrıca `musteriler` tablosundan alınır.
  - Böylece faz/pipeline kaydı olmayan report-only müşteriler de aktivite ekranında görünür.

- `components/activities/QuickActivityClient.tsx`
  - Müşteri listesi artık `/api/crm/list?lite=1&all=1` yerine `/api/activities/customers` endpointinden gelir.

- `app/api/crm/list/route.ts`
  - Normal davranış değişmedi: report-only müşteriler CRM/künye/pipeline listelerinde gizli kalır.
  - Opsiyonel `include_report_only=1` parametresi eklendi; sadece özel ihtiyaçlarda kullanılır.

## Beklenen davranış

- Normal CRM müşteri listesi: Seda/Cem müşterileri görünmez.
- Künye durumu/dashboard: Seda/Cem müşterileri görünmez.
- Aktivite ekleme: Seda/Cem müşterileri görünür.
- Teknik Ziyaret / Teknik Online: faz bilgisi istenmez.
- Kayıt: `activity_scope='technical'`, `affects_phase=false`, `faz_no=null` olabilir.
