# CRM yapısal analiz ve ilk hata düzeltmeleri

Tarih: 7 Eylül 2026. Bu belge kod incelemesi, canlı PostgreSQL üzerinde salt okunur sorgular, giriş yapılmış canlı ekran incelemesi ve yerel regresyon kontrollerine dayanır. Canlıya uygulama veya migration dağıtılmadı. Bu çalışma tüm rollerin bütün uçtan uca akışlarının hatasız olduğuna ilişkin bir sertifikasyon değildir.

## Ana karar

Bir firma aynı anda müşteri, iş ortağı ve entegratör olabilir. Firma tek kayıt olarak kalmalı; ilişkileri çoklu, yürüttüğü süreçler birbirinden bağımsız olmalı. Firmanın tipini çoklu seçim yapmak tek başına yetmez: fazın, sorumlunun, aktivitenin, yetkinin ve raporun hangi sürece ait olduğu da açıkça tutulmalıdır.

Örnek firma için aynı anda:

| Bağlam | Takip edilen iş | Örnek durum | Sorumlu |
|---|---|---|---|
| Müşteri | 100 cihaz satış fırsatı | Teklif / sipariş | Satış sorumlusu |
| Entegratör | A2A bağlantı projesi | Test / kabul | Teknik sorumlu |
| İş ortağı | Ortaklık geliştirme | Sözleşme / aktif ortaklık | Kanal sorumlusu |

Teknik test tamamlanması satış fırsatını kazanılmış yapmamalı. Bir sonraki cihaz satışı yeni fırsat olarak açılmalı; önceki satışın geçmişi korunmalı. Aynı firmanın farklı ürün entegrasyonları da ayrı süreç örnekleri olabilmeli.

## Mevcut yapı ve canlı bulgular

Next.js App Router + React + PostgreSQL kullanılıyor. PostgreSQL erişimi `lib/pg` içindeki query builder ve bazı doğrudan SQL servisleri üzerinden ilerliyor. Müşteri, aktivite, teklif, forecast, talepler, parametreler ve rol yönetimi mevcut; yeniden yazmak yerine bu temeli evrimleştirmek uygun.

İnceleme başındaki yerel Git HEAD `d34b2cc`, sunucudaki HEAD `3737c1d`. Bunlar farklıdır; yalnız HEAD bilgisi çalışan build'in veya çalışma ağacının birebir içeriğini kanıtlamaz. Dağıtım öncesi sürüm ve dosya farkı karşılaştırılmalıdır.

Canlı DB sayımları:

| Ölçü | Sonuç |
|---|---:|
| Firma | 648 |
| Standart tip | 501 |
| İş ortağı tipi | 147 |
| İş ortağı alt tipi “Entegrasyon Firması” | 99 |
| İş ortağı alt tipi boş | 48 |
| Aktivite / pipeline olayı | 2.476 |
| Teknik, fazı etkilememesi gereken olay | 497 |
| Account, fazı etkilememesi gereken olay | 22 |
| Teklif | 60 |
| Forecast satırı | 47 |
| Kullanıcı | 15 |
| `owner_user_id` boş firma | 376 |

Boş sahipliklerin 278'i standart firmalarda, 98'i iş ortaklarında. Boş kimlik alanı mutlaka veri kaybı anlamına gelmez: “Havuz Account”, “İş Ortakları” gibi metin sorumlular da kullanılıyor. Ancak bu metinler gerçek kullanıcı/ekip atamasının yerini tutmuyor.

### Kimlik ve yetki

`lib/auth/oidc.ts` Entra ID token'ındaki App Role değerlerini `system_oidc_app_role_mapping` ile CRM rollerine çeviriyor. Eşleşme yoksa erişim reddediliyor; geçerli kullanıcı ilk girişte oluşturulabiliyor. `auth_identities` tenant, subject ve object ID bağlantısını tutuyor. `lib/authz.ts` AD oturumundaki `effective_roles` kümesinin DB izinlerini birleştiriyor. Dolayısıyla güncel kod tek bir rolün statik matrisiyle sınırlı değil; bazı eski dokümanlar güncel davranışı tam yansıtmıyor.

Çalışan kimliği ile firmanın ticari ilişkisi ayrı kavramlardır. Entra/365 kullanıcısının rolü “bu kişi ne yapabilir?” sorusuna cevap vermeli. Firma üzerindeki “iş ortağı” ilişkisi kullanıcıya kendiliğinden erişim vermemeli.

### Firma, faz ve aktivite

- `musteriler.customer_type` ve `pipeline_policy` firma başına tek değer. `is_ortagi_tipi` ayrıca tek alt tip.
- `musteri_pipeline` birincil anahtarı yalnız `musteri_id`: firma başına tek aktif pipeline tutulabiliyor.
- `pipeline_eventleri` firma ve `faz_no` tutuyor; bağımsız süreç kimliği yok.
- Uygulama müşteri tipine göre `faz_tanimlari` veya `is_ortagi_faz_tanimlari` okuyor. Canlı DB'de olay ve pipeline faz foreign key'leri ise `faz_tanimlari` tablosuna bağlı. Aynı faz numarası iki katalogda farklı anlam taşıyabiliyor.
- `lib/activity-channels.ts` telefon/online/teknik ziyaret kanalından account/technical kapsamını ve faz etkisini türetiyor. İletişim kanalı ile işin amacı iç içe geçmiş.
- `lib/customer-segmentation.ts` faz numarasından müşteri kazanım durumu çıkaran fallback içeriyor. Ayrı iş ortağı fazları aynı ölçekte yorumlanmamalı.
- Teklifler ve forecast firma kimliğine bağlı; bağımsız ticari fırsat kimliği yeni modelin bir parçası olmalı. Teklif tutarı veya forecast adedi gerçek satış/teslimat kanıtı olarak kullanılmamalı.

## Bu çalışmada hazırlanan düzeltmeler

| Sorun | Düzeltme | Doğrulama |
|---|---|---|
| Aktivite oluşturma uç noktasının düzenleme yolu, başka firmanın aktivite kimliğini kabul edebiliyor; update izni ayrıca aranmıyordu | Firma/aktivite eşleşmesi, yazar sahipliği ve `activity.update.*` kontrolü; teknik kaydın kanal değiştirerek korunmadan çıkması engellendi | 5 API regresyon testi |
| Farklı owner ID mevcutken aynı e-posta/isim legacy fallback'i sahiplik verebiliyordu | Öncelik kesinleştirildi: ID varsa ID, yoksa e-posta, o da yoksa isim | 4 sahiplik testi |
| İş ortakları sayfalanmış müşteri listesine sonradan topluca ekleniyordu | Yetki kapsamını uygula → birleştir/tekilleştir → filtrele → sayfala. Atanmış firması olmayan kullanıcıya boş sonuç | 3 liste testi: iki sayfa, ortak kayıt, kapsam dışı ortak, boş sahiplik |
| Aktivite CSS'i genel `table`, `td`, `.surface` vb. seçicileriyle başka ekranları etkileyebiliyordu | Aktivite sayfası köküyle CSS kapsamı sınırlandı | Sayfa dışı tablonun computed min-width değeri 0px |
| Aktivite filtrelerinin sabit asgari genişlikleri, tablo kolon toplamının %100'ü aşması | Alan genişliğine uyarlanan grid, %100 kolon dağılımı ve tablo kabı içinde yatay kaydırma | Gerçek React bileşeni, örnek veri ile 390/768/1024/1280/1440px ölçümleri |
| Filtre label bağlantıları eksik, “Quarterly” etiketi Türkçe ekranda kalmış | Arama erişilebilir adı, select label bağlantıları, “Üç Aylık” etiketi | Yerel render / derleme |
| Teklif ekranında iki hero; biri sabit 5/12/3 değerleri gösteriyordu | Sabit verili hero sayfadan çıkarıldı; API verisini kullanan portföy hero'su kaldı | Canlı ekranda ve kaynakta doğrulandı; derleme |
| DB tetikleyicisi teknik/not olayında da ana fazı güncelliyordu | `20260907_012_pipeline_non_phase_activity_guard.sql`: insert/update/delete ve rebuild işlemleri faz etkisini dikkate alıyor | Yerel gerçek PostgreSQL'de transaction içinde ekleme, düzenleme, silme, yeniden oluşturma, kapsam dönüşümü; tamamı rollback |

Migration mevcut bozuk olabilecek özetleri topluca yeniden hesaplamaz. Geçmiş onarımı ayrı bir önce/sonra fark raporuyla yapılmalı. Uygulama dosyaları ve migration yerelde hazırdır; canlıda henüz etkin değildir.

Müşteri sayfalamasındaki düzeltme uyumluluk için birleştirilecek yetkili kayıtları uygulama tarafına alır. 648 firmalık mevcut veriyle doğruluk sorunu çözülür; büyümede birleştirme/filtre/sayfalama tek SQL sorgusu veya kanonik view üzerinden yapılmalıdır. Performans yük testi yapılmadı.

## Yeni veri modeli önerisi

### Kullanıcının netleştirdiği kapsam

Entegrasyon firmaları mevcut **İş Ortağı Aktiviteleri** akışını kullanacak. Ayrı bir üst seviye “Entegrasyon Durum Aktivitesi” modülü/türü açılmayacak. Entegrasyon durumunun izlenmesi bu bağlamda tasarlanacak; durum kataloğunun ayrıntıları henüz kesinleştirilmedi. Aynı firmanın cihaz satışı müşteri/satış bağlamında bağımsız izlenecek.

Firma kartından açılan **Teknik Yetkililer** ekranı isteniyor:

| Alan | Davranış önerisi |
|---|---|
| Ad Soyad | Kişinin görünen adı; zorunlu |
| Telefon | Ülke kodunu destekleyen metin alanı |
| E-posta | E-posta biçim doğrulaması |
| Ünvan (Title) | Teknik müdür, yazılım uzmanı vb. görev adı |

Bir firmaya birden fazla kişi eklenebilmeli; ekleme, düzenleme ve pasife alma sunulmalı. Teknik yetkili eklemek Entra kullanıcısı oluşturmaz ve erişim izni vermez. İş Ortağı Aktivitesi formunda ilgili kişi seçilebilmeli; başka firmanın kişisi API'de reddedilmeli. Kişi pasife alınsa bile eski aktivitelerdeki bağ ve görüşme geçmişi korunmalı. Ekranın görüntüleme/düzenleme izinleri firma/süreç kapsamına tabi olmalı.

Teknik Yetkililer ekranı ve İş Ortağı Aktivitesi içinden kişi seçimi **yerelde uygulandı; canlıya dağıtılmadı**. Ad Soyad zorunlu; telefon, e-posta ve ünvan isteğe bağlı. Firma başına birden fazla kişi, düzenleme, pasife alma ve aktifleştirme desteklenir. Firma güncelleme yetkisi yazma işlemlerini belirler. API aynı transaction içinde audit yazar; sürüm numarası eski bir formun güncel kaydı ezmesini engeller. Aktivite/kişi bağlantısı firma kimliğiyle birlikte foreign key üzerinden doğrulanır. Pasif kişi yeni aktivitede seçilemez; geçmiş bağlantı korunur. Eski istemci kişi alanını göndermiyorsa düzenleme mevcut bağlantıyı temizlemez. Mevcut tekil metinlerden otomatik kişi aktarımı yapılmadı.

| Varlık | Görev |
|---|---|
| Firma (`organizations`; başlangıçta mevcut `musteriler`) | Ünvan, vergi kimliği, sektör, adres; tek ticari kimlik |
| Firma ilişkileri (`organization_roles`) | Müşteri ve iş ortağı eşzamanlı olabilir; entegrasyon firması iş ortaklığının alt türüdür. İlişkinin aktifliği/geçerlilik tarihleri ayrı tutulur |
| Firma bağlantıları (`organization_relationships`) | Hangi entegratör hangi son müşteriye hangi projede hizmet veriyor |
| Süreç şablonu / sürümü (`process_definitions`) | Satış, entegrasyon, ortaklık için ayrı kurallar ve faz katalogları |
| Süreç örneği (`process_instances`) | Firma, süreç türü/sürümü, ürün veya proje, sorumlu, ekip, aktif aşama |
| Ticari fırsat (`opportunities`) | Beklenen satış, ürünler, tutar, olasılık, kapanış; teklif ve forecast bağlantısı |
| Aktivite (`activities`) | Firma, birincil süreç, kanal, amaç/tür, katılımcılar, kendi tamamlanma durumu |
| Faz geçişi (`stage_transitions`) | Hangi süreçte kim, ne zaman, hangi kanıtla hangi geçişi yaptı |
| Süreç üyeliği (`process_members`) | Satış sahibi, teknik sorumlu, destekleyen ekip, izleyici; kullanıcı/ekip kimliğiyle |
| İlgili kişiler (`contacts`) | Firma kişilerinin görevleri ve projedeki rolleri; çalışan AD hesaplarından ayrı |
| Kurulu ürünler / teslimatlar | Gerçek satılan/kurulan cihazlar, model, adet, tarih; tekliften ayrı gerçekleşme kaydı |

Bir görüşmede birden çok süreç konuşulursa tek aktivitenin ilişkili süreçleri olabilir; faz değiştirme ise her süreç için açık ve ayrı geçiş olayı olmalıdır. Salt “Telefon” seçilmesi satış fazını ilerletmemeli.

Faz adı değiştirilince eski kayıtların anlamı değişmemeli. Şablon sürümü ve stabil faz kimliği kullanılmalı; `faz_no` yalnız gösterim sırası olmalı. Faz geçişlerinin zorunlu alanları ve onay kuralları parametrik, güvenlik ve geçiş doğrulaması sunucuda olmalı.

## Yetki modeli önerisi

Karar: kullanıcı izni + firma/süreç kapsamı + kaydın durumu birlikte değerlendirilir. Örneğin teknik sorumlu entegrasyon projesinde test sonucu girebilir; teklif indirimi veya satış kazanma işlemi farklı izindir.

- Entra App Role eşleşmesi ve mevcut permission matrisi korunur.
- Görüntüleme, oluşturma, düzenleme, faz değiştirme, atama ve onay ayrı izinlerdir.
- Kapsam: kendi, üye olduğu süreç, ekibi, tüm şirket. Firma sahibi olmak bütün süreçlerin sahibi olmak değildir.
- Firma genel sorumlusu ve süreç sorumluları ayrı tutulur. Havuzlar gerçek ekip/portföy olarak modellenir.
- UI aynı izinleri kullanır; veri ve aksiyon kontrolünün son kararı API'dedir.
- Rol kaldırılması, oturum iptali ve yetki değişikliklerinin geçerlilik süresi açıklaştırılır. Bugünkü effective-role oturum snapshot'ı ile rol-matrisi değişikliği farklı mekanizmalardır.
- AD kimliği olmayan firma ilgili kişilerine otomatik çalışan hesabı veya şirket içi erişim verilmez.

## UI yönü

Firma kartında tek bir “aktif faz” yerine “Müşteri / Cihaz Satışı” ve “İş Ortağı” süreç kartları bulunur. Entegrasyon çalışması mevcut İş Ortağı Aktiviteleri içinde yürür; ayrı bir üst seviye entegrasyon aktivite modülü açılmaz. Her süreç kendi sorumlusunu, fazını, son aktivitesini, bekleyen aksiyonunu ve engelini gösterir. Üstte birleşik firma özeti, altta bağlama göre filtrelenebilen zaman akışı bulunur.

Aktivite formu: firma → ilgili süreç → aktivite amacı → kanal → not/aksiyon. Süreç bir tane ise önceden seçilir; birden fazla ise kullanıcı seçer. Zorunlu alanlar seçilen sürece göre değişir. Faz geçişi ayrı, açıklanabilir bir işlem olur.

Mobilde özet kart ve kritik aksiyonlar görünür; detay tablo kontrollü kayar. Ortak sayfa başlığı, filtre alanı, boş/yükleniyor/hata durumları ve responsive tablo bileşeni kullanılmalı. Genel CSS ile başka ekranların boyutunu değiştiren kurallar diğer stil dosyalarında da adım adım ayrıştırılmalı.

Canlı genel bakış, müşteri, aktivite, forecast ve teklif ekranları açılarak incelendi; en somut görsel/davranışsal hatalar müşteri sayfalaması ve teklifin sahte ikinci özetiydi. Tüm ekranların bütün genişliklerde ve bütün rollerle doğrulaması tamamlanmış değildir. Yerel beş genişlik testi değişen aktivite bileşeni içindir; tam uygulama rol testi yerine geçmez.

## Sonraki öncelikler ve geçiş

1. İlk hata paketi: dağıtılacak sürümü canlıyla karşılaştır, migration incelemesi ve yedek sonrası kontrollü dağıtım, canlı salt okunur smoke kontrolü. Bu belgede canlı dağıtım yapılmış sayılmaz.
2. Aktivite tamamlama servislerini transaction ve merkezi audit altında toplamak. `completeActivitiesForSamePhase` bugün diğer aktivitelerin notlarını da değiştirebiliyor; `completePreviousOpenActivities` aynı firmanın önceki fazlarını topluca kapatıyor. Teknik/account, iterasyon ve yeni süreç sınırı açıkça korunmalı.
3. Diğer aktivite uçlarında teknik kayıt düzenleme, HTTP 403 hata dönüşleri, plan doğrulamasının yazmadan önce yapılması ve faz kataloğu doğrulamasını ortak kurala taşımak. İlk create/edit koruması bütün uçların denetlendiği anlamına gelmez.
4. 376 boş owner kimliğini kullanıcı ve gerçek ekip ataması olarak sınıflandırmak. Sadece isim benzerliğiyle otomatik yetki verilmemeli.
5. Yeni firma ilişkisi ve süreç tablolarını mevcut sisteme eklemek. Eski müşteri ID'leri korunmalı; aynı firmayı müşteri ve ortak olarak iki kez açmamalı.
6. Geçmiş aktiviteleri yeni süreçlere eşlemek. Tipi zaman içinde değişmiş veya faz numarası belirsiz kayıtlar insan doğrulamasına ayrılmalı; tahmini eşleme ile geçmişi sessizce yeniden yazmamalı.
7. Pilot karma firmada paralel satış + entegrasyon + ortaklık senaryosunu doğrulamak. Sonra raporlar, teklif ve forecast bağlarını kademeli taşımak.
8. Firma raporu `distinct organization_id`, fırsat raporu fırsat, teknik performans teknik süreç saymalı. Ortaklık ile satış cirosu aynı havuzda tekrar sayılmamalı.

Güvenli geçiş koşulları: eski kayıt sayıları ve tutarlar uzlaşmalı, belirsiz eşlemeler listelenmeli, faz geçmişi korunmalı, tersine geçiş yolu bulunmalı, kendi/ekip/tüm şirket kapsamları negatif testlerle doğrulanmalı.

## Doğrulama kaydı

- Başlangıç: 67 test geçti.
- İlk paket: 76 test, TypeScript, lint ve production build geçti; lint 92 uyarı, 0 hata bildirdi.
- Son eklenen müşteri sayfalama/kapsam testleri: 3/3 geçti.
- DB regresyonu: `node --env-file=.env.local scripts/test-pipeline-non-phase-guard.mjs` geçti; yalnız localhost kabul eder, tüm değişiklikleri rollback yapar.
- Final `npm run verify`: başarılı; 10 dosyada 79 test, TypeScript ve production build geçti. Lint 92 uyarı, 0 hata bildirdi. Uyarılar ayrı temizlik listesi olarak kalıyor.
