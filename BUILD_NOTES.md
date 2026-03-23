# Build Notları

## Phase Engine
- DB bağlanmadı → fallback çalışıyor
- customer_phase_logs eklenecek

## Teklif Modülü
- pricing_rules kontrol edilecek
- CSV import sonra eklenecek

## System Tracker
- tam aktif
- tüm eksikler buradan takip edilecek

## Customer Segmentation
- Firma Durumu ve Yönetim Tipi ekranlarda aktif
- Şu an phase fallback modu ile çalışıyor
- Gelişen / Riskli / Pasif kuralları rehber sayfasında tanımlı
- Backend bağlanınca gerekli sinyaller: last_activity_days, open_opportunity_count, active_device_count, growth_signal_count, risk_signal_count

## Customer Status Guide
- /crm/customer-status-guide sayfası ekip içi referans ekranı olarak eklendi
- Rehber tasarımı hazır, backend sonra bağlanacak

## Müşteri Segmentasyonu Filtreleri
- Firma Durumu filtresi aktif (ilk aşama UI filter)
- Yönetim Tipi filtresi aktif (ilk aşama UI filter)
- Backend bağlanınca sunucu tarafı filtre ve gerçek sinyal hesabı devreye alınacak

## Customer Segmentation Override
- Firma detayı ekranında manuel override UI aktif
- Demo aşamasında local storage kullanır
- Backend bağlanınca kalıcı alanlara taşınacak

## Dashboard
- CRM ana ekranı yeni kazanım + portföy yönetimi mantığıyla güncellendi
- Firma Durumu / Yönetim Tipi özetleri faz fallback ile çalışır
- Backend bağlanınca risk ve büyüme sinyalleri gerçek veriden beslenecek


## Dashboard v2
- CRM ana ekranı grafik ağırlıklı command center yapısına çevrildi
- Firma Durumu / Yönetim Tipi müşteri detayında Temel Bilgiler blokundan ayrıldı
- Segmentasyon kuralı artık Müşteri Yönetimi kartı içinde gösteriliyor
- Backend bağlanınca risk / growth / passive skorları gerçek sinyallerle beslenecek
