# CRM Performans Hızlandırma Notları

Bu turda amaç, kurumsal CRM kullanımında liste ekranlarının gereksiz tüm veri çekmesini azaltmak ve sayfa sayfa veri akışını güçlendirmekti.

## Yapılan güvenli iyileştirmeler

### 1. Müşteri listesi
- `include_report_only=1` artık tek başına tüm müşteri havuzunu çekmeye zorlamıyor.
- Normal liste kullanımı DB tarafında `page/pageSize` ile sayfa sayfa çalışıyor.
- Künye/kasa/serbest arama gibi uygulama katmanı filtreleri gerektiğinde toplu havuz kullanıyor.
- Toplam kayıt hesabı normal liste modunda DB count değerinden geliyor.

### 2. Teklif portföyü
- Teklif listesi artık `page` ve `pageSize` destekliyor.
- Normal modda gerçek server-side pagination kullanıyor.
- Arama modunda müşteri/ürün özeti gibi join sonrası alanlar için sınırlı havuz alıp sayfalıyor.
- UI tarafına sayfa boyutu, önceki/sonraki ve toplam kayıt bilgisi eklendi.

### 3. Korunan kurallar
- Login/yetki yapısına dokunulmadı.
- SQL klasörüne yeni dosya eklenmedi.
- Mevcut iş ortağı/faz/parametre kurgusu korunarak ilerlenildi.
- `script.md` zorunlu kuralları korunmuştur.

## Sonraki kurumsal performans adımları

1. `vw_crm_musteriler` üzerinde arama için normalize edilmiş search column/materialized view.
2. Künye durumunun view içine alınması; böylece künye/kasa filtreleri de DB tarafında sayfalı çalışır.
3. Teklif listesinde ürün özeti için `quote_list_view` oluşturulması.
4. Aktivite raporları için rapor amaçlı özet view/materialized view.
5. Filtre option endpointlerinde cache kontrollü kısa TTL veya parametre bazlı versiyonlama.
