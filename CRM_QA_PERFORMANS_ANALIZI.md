# CRM QA ve Performans Analizi

Bu turda sistem, kurumsal CRM mantığıyla sayfa/API/veri çekme akışı üzerinden tarandı.

## Uygulanan düzeltmeler

### 1. Aktivite müşteri seçimi hızlandırıldı
Önceden aktivite ekleme ekranı açılırken müşteri/iş ortağı havuzu yüksek limitlerle yükleniyordu. Bu, veri büyüdükçe form açılışını yavaşlatır.

Yeni yapı:
- İlk açılışta sadece sınırlı müşteri seti gelir.
- Kullanıcı arama yaptıkça DB tarafında daraltılmış sonuç gelir.
- Düzenleme modunda seçili müşteri ayrıca korunur.

### 2. Aktivite dashboard payload hafifletildi
Aktivite listesinde dashboard için çekilen analytics datası artık liste satırındaki tüm not/blokaj detay payloadını taşımıyor. Dashboard için gereken minimum kolonlar seçiliyor.

### 3. Müşteri liste toplam sayısı düzeltildi
CRM müşteri listesinde sayfalı çekimde toplam kayıt hesabı bazı durumda sadece o sayfanın satır sayısına düşebiliyordu. Bu, pagination hissini bozabilir. `result.count` korunacak şekilde düzeltildi.

### 4. Aktivite blokaj sonrası dashboard state bozulması düzeltildi
Blokaj güncellemesinden sonra analytics state yanlışlıkla sadece mevcut sayfa satırlarına indirgenebiliyordu. Artık sadece ilgili satır güncelleniyor.

### 5. QA Agent eklendi
Yeni script:

```bash
npm run qa:crm
```

Taranan başlıklar:
- yüksek `.limit()` kullanımı
- liste ekranlarında `select(*)` riski
- API fetch cache/no-store kontrolü
- payload büyüme noktaları

## Kalan bilinçli uyarılar

QA Agent bazı bilinçli uyarılar verir. Bunların tamamı kritik değildir.

Örnekler:
- rapor ekranları doğal olarak geniş veri okuyabilir
- detay ekranlarında `select(*)` bazı durumlarda kabul edilebilir
- POST/DELETE/PATCH işlemlerinde no-store uyarısı uygulanmaz

## Sonraki kurumsal hızlandırma fazı

1. `/api/activities/list` için ayrı `/summary` endpoint oluşturulması
2. `/api/crm/options` ve `/api/activities/options` için DB distinct/RPC tabanlı seçenek servisi
3. Rapor ekranlarına tarih aralığı zorunluluğu veya lazy load
4. Teklif istatistiklerinin aggregate SQL/RPC ile hesaplanması
5. İndeks migration dosyasının canlı DB durumuna göre kontrollü eklenmesi

