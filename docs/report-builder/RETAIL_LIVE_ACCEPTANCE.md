# Retail: altı sekme için canlı kaynak kabul kontrolü

20.10.2026. Bu kontrol geçmiş HTML snapshot eşitliğini değil, aynı kanonik kayıtların düzenleme sonrası bütün ilgili görünümleri tutarlı güncellemesini hedefler. Test için üretim kaydı değiştirilmez; izole fixture ve API istek kontrolleri kullanılır.

## Kaynak ayrımları

- Müşteri kartındaki Lead/Hunter/Kasa/Farmer etiketi `musteri_kunye_v2.satici_etiketi` alanıdır. Native künye düzenleme API'si bu alanı kaydeder. `musteri_pipeline.aktif_faz_no` / `faz_tanimlari.asama_adi` ayrı süreç fazıdır. Frozen `crm_retail_pool_memberships.retail_status` güncel müşteri etiketi yerine kullanılamaz.
- `crm_musteri_listesi.kategori` L/H/F/K kişi bazlı Müşteri Listesi'dir; serbest firma metni ve kanonik `musteri_id` içerir. Kişi portföyü raporunun kaynağı olması müşteri kartı etiketini otomatik değiştirdiği anlamına gelmez. Bu iki alan sessizce birleştirilmemeli.
- Forecast `sale_type` satış / kiralama türüdür; `sales_channel` ayrı Banka/Direkt Satış/Kanal/İş Ortağı bilgisidir. Banka kanallı kiralama, satış türüne dönüştürülmemeli. Referans HTML iş modeli veya firma adıyla native tür tahmini yapılmamalı.
- Güncel Retail müşteri kapsamı kanonik departman alanından belirlenir. Snapshot üyeliği, rapor adı, geçmiş firma etiketi veya kaynak başlığı, global kayıtları salt referans sayısına ulaşmak amacıyla gizleyemez.
- Native Forecast ayı kendi `forecast_month` değeridir. Cari yıl kayıtlarını Aralık ayına zorlamak full-live davranış değildir. Gerçekleşen satış tarihi ile planlanan teslim ayı ayrı tutulmalı.

## Düzenleme → beklenen etki matrisi

| Sekme | Kanonik kaynak / düzenleme | Yenileme sonrası zorunlu etki | Etkilenmemesi gereken |
|---|---|---|---|
| 1 Mevcut durum | Aktif satış tarihi, ürün kalemi adedi/türü, USD tutar | Firma satışı, terminal KPI, USD KPI ve model özeti değişir; aktif olmayan / yıl dışı kayıt çıkartılır | Forecast ve senaryo oranı gerçekleşen rakamı değiştirmez |
| 1 Mevcut durum | Hizmet faturası dönem/adet/fiyat/durum; künye aktif kasa | Ay bazlı adet/gelir, referans ay, firma oranı ve fırsat yeniden hesaplanır | Son tarife geçmiş ay faturalarına uygulanmaz; teklif gelir değildir |
| 1 Kiralama | Aktif satış kiralama kalemi, operasyon durumu, başlangıç/bitiş ve aylık bedel | Aktif cihaz/aylık gelir yalnız güncel geçerli sözleşmelerden hesaplanır | Sent/draft teklif veya aktivite metni aktif kira tahsilatı yaratmaz |
| 2 Cari yıl fırsatları | Native aktif Retail Forecast adedi, modeli, türü, kanal, olasılık | Firma/model tablosu, satış/kiralama/banka sayıları gerçek alanlarla değişir | HTML firma türü veya sabit 15 satır referansı uygulanmaz |
| 3 Sonraki yıl projeksiyon | Native Forecast yılı/ayı/adedi/modeli | Kayıt doğru yıl/aya taşınır; yıl ve ay toplamları değişir; değişiklik kanonik Forecast API'sine gider | Diğer müşterilerin kayıtları ve gerçekleşen satış değişmez |
| 4 CRM havuzu | Künye `satici_etiketi`, kasa sağlayıcısı/adedi, POS, sektör; müşteri Account | Satır, filtre seçenekleri, dağılımlar ve bilgi KPI'ları güncellenir; statü ayrıntılı fazdan ayrı kalır | Frozen referans statüsü/sağlayıcı grubu geri gelmez; farklı ID'ler ada göre birleştirilmez |
| 4 Plan oluşturma | Kanonik müşteri+ürün, yıl/ay, adet, tür, fiyat ile native Forecast create | Oluşan kayıt yenilemede yıl/firma/model/ay tablolarına bir kez gelir | Ekranın bağımsız plan tablosuna yönelmesi veya yalnız tarayıcı kaydı kabul edilmez |
| 5 Cari yıl sonuçları | Native Forecast ay/adet/tür/fiyat; senaryo yüzde | Plan gerçek ayda görünür; model/ay ve detay toplamları aynı yuvarlama kuralını kullanır; fiyat boşsa boş kalır | Cari yıl planı Aralık sabitine taşınmaz; olasılık senaryo yüzdesinin yerine geçmez |
| 6 Sonraki yıl sonuçları | Native Forecast ay/adet/model; finansal fiyat/tür | Yıl tablosu ve firma detayları aynı kaynak kümesi / aynı yuvarlanmış toplamı verir | Mart varsayımı, HTML fiyat sabiti veya gömülü CRM planı eklenmez |

## Somut keşif ve test sınırı

- 20.10.2026 06:32 UTC salt okunur DB sorgusunda Retail 551 müşteri için native künye etiketleri: Lead 414, Hunter 95, Farmer 22, Kasa 20. Bu değer bir kabul sabiti değildir; güncel veri değişince doğal olarak değişmelidir.
- Aynı okumada Retail aktif 2026/2027 Forecast satırlarının türü `sale`; Banka ayrı kanaldır. Bunları geçmiş HTML'de kiralama yazdığı için rental'a çevirmek veri doğruluğu değildir.
- İnceleme anında `retail-projection.ts` cari yıl planını ay 12'ye sabitleyen bir yol içeriyordu; `retail-native-source-parity.test.ts` bunu doğrudan yakalayan regresyon içerir. Hesap katmanı sahibi bu yolu düzeltti; 20.10.2026 yeniden çalıştırmada dört native kaynak regresyonu geçti.
- Salt okunur keşif kanıtı: `.theme-audit/retail-review/native-source-discovery-20261020.json`. Üretimde düzenleme yapılarak test edilmedi.
- Kaynak düzenleme yetkileri normal API guard'larından geçmeli; rapor okuma yetkisi düzenleme yetkisi değildir. Create/update isteğinde canonical ID, tür/fiyat, yıl/ay ve concurrency sözleşmesi doğrulanmalı. Hata sonrası başarı mesajı veya eski veriyi yeni gibi göstermek kabul edilmez.


## İzole regresyon kabul sonuçları

- lib/reports/retail-native-source-parity.test.ts: dört test; cari yıl ay/adet düzenlemesi yalnız plan katkısını taşır, gerçekleşenler sabit kalır; model/fiyat düzenlemesi sonuçlara yansır; bank kanalı kiralama türünü ezmez; pasif katkı çıkarılır ve olasılık senaryo yüzdesine dönüşmez.
- app/api/forecast/update/route.test.ts: on test; PostgreSQL mikrosaniye timestamp'i kayıpsız bağlanır, stale/erişim değişimi sıfır satırda 409, legacy timestamp'siz istek desteklenir, geçersiz sürüm 400, own yetkisi başka müşteri için UPDATE yapmaz, UPDATE atomik owner/is_active koşulunu taşır.
- app/api/reports/retail-operasyon/route.test.ts: dört test; any/own/readonly per-record canEdit/canPlan ve reports access reddi doğrulanır.
- Üç dosya toplam **18 test geçti**, hedefli ESLint temiz. Bunlar gerçek handler/saf hesap katmanlarını izole API/DB mock'larıyla çalıştırır; üretimde veri yazma veya tarayıcıdan kaynak düzenleme testi yapıldığı iddiası taşımaz.

## 2026-10-20 — Six tabs use canonical live CRM (supersedes separate-plan runtime)
All six Retail tabs now query native active Retail Forecast, customers/künye, sales/items, rentals and service invoices. HTML and crm_retail_plan_entries/crm_retail_pool_memberships are historical archives only; no runtime imports, no deletion. Native Forecast year/month, sale/rental and configured Banka channel are preserved. CRM pool includes every current Retail customer without name deduplication. Editor/create use canonical Forecast APIs with per-customer permissions and optimistic concurrency. Refresh on focus and every visible 60 seconds, pausing for active forms.
Validation: isolated six-tab browser checks; canonical live DB transaction proved create, year/month/quantity, label/provider, sales and invoice changes propagate; all test mutations rolled back and absence of temporary record verified. Deployment uses scripts/deploy-live.sh; see RETAIL_LIVE_ACCEPTANCE.md. Previous strict HTML parity verifier concerns archived import only and is not the live-screen acceptance criterion.
