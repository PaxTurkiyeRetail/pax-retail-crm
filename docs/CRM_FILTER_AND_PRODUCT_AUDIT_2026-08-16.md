# CRM Filtre, Ürün Yolculuğu ve Canlı Güven Denetimi

Tarih: 16 Ağustos 2026  
Kapsam: CRM web/mobil ekranları, filtre sözleşmeleri, rol/yetki akışları, ürün güveni ve canlı yayın güvenliği.

## Karar özeti

Uygulamanın kurumsal temeli güçlendirildi; ancak bütün ekranların tek filtre altyapısına taşınması ve rapor yetkilerinin `own/team/all` kapsamlarına ayrılması tamamlanmadan ürün “nihai kurumsal seviye” kabul edilmemelidir. Bu çalışma canlı veritabanına migration uygulamadı ve deploy yapmadı.

## Bu dilimde tamamlananlar

- Statik iç proje notlarını son kullanıcıya açan `Sistem Takibi` sayfası, bileşenleri, menü kaydı ve stilleri tamamen kaldırıldı.
- Ana yönetim raporundaki BANKA/VERTICAL dışlamaları ve kişi adına bağlı rapor/akış istisnaları kaldırıldı. Yetki kontrolleri permission bazında devam ediyor. Dağıtım raporuna özgü sektör/POS sınıflaması ayrı bir iş tanımı olarak hâlâ parametrik modele taşınmalıdır.
- `crm_phase_optional_responsibles` adlı kişi bazlı faz muafiyeti; API, parametre tanımı ve yönetim UI'ından kaldırıldı. Migration eski parametre kayıtlarını temizleyecek; canlıda henüz çalıştırılmadı.
- Aktivite listeleme, detay, seçenek, oluşturma, güncelleme, tamamlama ve engelleme uçlarında `own/any` kapsam kontrolü eklendi.
- Teklif oluşturma ve katalog yönetimi, forecast yazma, DB yedeği, blocker ve Sales Radar sayfalarının permission kapıları gerçek aksiyonlarıyla eşleştirildi.
- Yalnız talep yetkisi olan `user` rolü için ölü yönlendirme döngüsü kaldırıldı; Talep merkezi gerçek giriş noktası oldu.
- Müşteri listesindeki yalnız açık sayfayı filtreleyen ve toplam/KPI'yı yanlış gösteren iki istemci filtresi kaldırıldı.
- Teklif portföyü KPI isteği listeyle aynı filtre sorgusunu kullanıyor; müşteri toplamı filtrelenmiş toplamı doğru döndürüyor; aktivite filtre temizleme engel filtresini de sıfırlıyor.
- `/crm/me` ekranındaki sahte KPI ve agent verileri kaldırıldı; gerçek kullanıcı ve efektif permission bilgisi gösteriliyor.

## Canlı öncesi P0 kalanlar

1. `report.read` çok geniştir. Bu nedenle `account_manager` varsayılanından çıkarıldı. `report.read.own`, `report.read.team`, `report.read.all`, `report.management.read`, `report.user-performance.read` ve `report.export` ayrımı yapılmalıdır. Haftalık aktivite ve satıcı özetleri bu kapsam uygulanmadan şirket geneline açılmamalıdır.
2. CRM araması ilk DB sorgusunda müşteri/sektör/sorumlu/faz alanlarıyla sınırlı, sonraki istemci mantığı entegrasyon/kasa/künye alanlarını da arıyormuş gibi davranıyor. Arama tek server-side sözleşmeye taşınmalıdır.
3. Aktivite, teklif, seçenek ve Sales Radar uçlarında 500–10.000 arası sessiz üst sınırlar vardır. Kurumsal ölçekte eksik KPI veya eksik seçenek üretmemesi için gerçek pagination/aggregate sorguları kullanılmalıdır.
4. Forecast ve bazı rapor akışlarında kalan rol adı/kişi adı kontrolleri merkezi permission + kalıcı kullanıcı kimliğine taşınmalıdır.
5. Teklif kataloğunda tablo yoksa fiyat kod içi fallback ile devam etmemeli; canlı ortamda güvenli biçimde hata vermelidir.
6. Müşteri durum override işlemi gerçek kaydetme API'si olmadan başarı mesajı göstermemelidir. Nova Core, rehber/onboarding ve satış süreci gibi statik/demo ekranlar ya gerçek kaynağa bağlanmalı ya da menüden kaldırılmalıdır.
7. Jira değişkenleri mevcut çalışma ortamında eksiktir. Staging/production secret ve ağ erişimi doğrulanmadan Jira verisinin gelmesi beklenmemelidir.

## Hedef filtre sözleşmesi

Her liste ekranı aynı `FilterSpec` ve `VisibilityPredicate` kullanmalıdır:

- URL query parametreleri tek kaynak olmalı; geri/ileri, paylaşılabilir bağlantı ve yenileme aynı sonucu üretmelidir.
- Metin araması 300 ms debounce ve `AbortController` kullanmalıdır; eski istek yeni sonucu ezmemelidir.
- Mobilde filtreler drawer/bottom-sheet içinde, aktif filtreler chip olarak ve tek “Tümünü temizle” aksiyonuyla sunulmalıdır.
- Satırlar, `total`, KPI, facet seçenekleri ve export aynı filtre + yetki kapsamıyla hesaplanmalıdır.
- Tarih aralıkları server tarafında doğrulanmalı; başlangıç bitişten büyükse 400 dönmelidir.
- Hiçbir endpoint sessizce ilk 500/1000 kaydı “tam veri” gibi sunmamalıdır.

Önerilen cevap metası:

```json
{
  "rows": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "scope": "own",
    "filters": {},
    "warnings": []
  },
  "facets": {},
  "summary": {}
}
```

## Mobil/web ürün kararları

- Dashboard iki kolonlu inline grid'i küçük ekranda tek kolona düşmelidir.
- Teklif filtreleri ve teklif oluşturma formundaki sabit kolonlar responsive grid standardına taşınmalıdır.
- Sales Radar'ın `min-width: 900px` tablosu mobil kart/özet görünümü kazanmalıdır.
- 360, 390, 768, 1024 ve 1440 px görsel regresyon matrisi; rol matrisiyle birlikte Playwright testine alınmalıdır.
- Hassas CRM verisi PWA offline cache'e alınmamalıdır.

## Güvenli uygulama sırası

1. Production yedeği + geri yükleme kanıtı.
2. Migration'ın staging kopyasında uygulanması; yeni permission kayıtlarının ve eski kişi bazlı parametre temizliğinin doğrulanması.
3. Rol/permission API matrisi ve rapor görünürlük testleri.
4. Ortak FilterBar'ın önce müşteri ve aktivitede, sonra teklif/forecast/raporlarda dilimler halinde yayılması.
5. Mobil görsel regresyon ve gerçek cihaz smoke testleri.
6. Canary yayın, sağlık/Jira kontrolleri, hata oranı ve rollback eşiği takibi.

Migration ve uygulama sürümü birlikte yayınlanmalıdır. Yeni permission satırları DB'ye eklenmeden yeni sürüm açılırsa doğru kullanıcılarda beklenmeyen 403 oluşabilir.
