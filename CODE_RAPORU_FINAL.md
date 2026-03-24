# CRM Code Raporu – Final Cleanup

## Bu pakette yapılanlar
- `Genel Bakış` menüde **beta** olarak işaretlendi.
- `Satıcı Özeti` ana rapor olarak korundu: `/crm/reports/seller-summary`
- `/crm/reports` bu rapora yönleniyor.
- `Teklifler` kök sayfası düzeltildi; artık yanlışlıkla print sayfası açmıyor.
- `Teklif detay` route'u düzeltildi; artık detay ekranı `QuoteDetailClient` ile açılıyor.
- Aşağıdaki eski/istenmeyen route'lar fiziksel olarak kaldırıldı:
  - `/crm/approvals`
  - `/crm/customer-status-guide`
  - `/crm/me`
  - `/crm/nova-core`
  - `/crm/sales-process`
  - `/crm/sales-radar`
  - `/crm/system-tracker`
  - `/crm/reports/management`

## Stabilite sınıflandırması
### Stable
- `/crm/customers`
- `/crm/reports/seller-summary`
- `/requests`

### Beta
- `/crm`
- `/crm/activities`
- `/crm/quotes`
- `/crm/reports/weekly-activities`
- `/requests`

## Bilinen notlar
- `Satıcı Özeti` API'si hâlâ DB kolon isimlerine duyarlı.
- `Teklifler` modülü beta işaretli bırakıldı.
- Kod tabanında route'u kaldırılmış ama component olarak duran bazı eski dosyalar olabilir; bunlar artık menüden erişilmez.

## Önerilen sonraki adım
1. `seller-summary` API'sine schema fallback eklemek
2. `activities` ekranını hook/component katmanlarına ayırmak
3. `requests` alanını CRM altında tek namespace'e taşımayı değerlendirmek
