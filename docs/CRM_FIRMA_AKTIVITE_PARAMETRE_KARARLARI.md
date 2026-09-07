# Firma, aktivite ve parametrik yetki tasarımı

7 Eylül 2026 — Kullanıcının görüşme içinde netleştirdiği hedef. Aşağıdaki çoklu ilişki ve süreç modeli tasarımdır; bu belge tamamlanmış uygulama veya canlı dağıtım anlamına gelmez. Teknik yetkili ekranı ve ilk parametre sadeleştirmeleri yerelde uygulanmıştır.

## Firma kimliği ve ilişkiler

Firma bir kez açılır. Aynı firma hem müşterimiz hem iş ortağımız olabilir. “Entegrasyon Firması” iş ortaklığının alt türüdür. Sektör, iş kolu, firma ilişkisi, ilişki aktifliği ve süreç fazı ayrı kavramlardır.

| Bilgi | Örnek | Kural |
|---|---|---|
| Firma | ABC Yazılım AŞ | Tek kimlik, ortak künye ve teknik yetkililer |
| İlişkiler | Müşteri + İş Ortağı | Birlikte seçilebilir; biri diğerini silmez |
| İş ortağı alt türü | Entegrasyon Firması | İş ortaklığı ilişkisine bağlı |
| Müşteri ilişkisi durumu | Aktif | İş ortaklığının durumundan bağımsız |
| Müşteri süreci | 100 cihaz satışı | Kendi fazı, sorumlusu, teklifleri ve aktiviteleri |
| İş ortağı süreci | Ödeme entegrasyonu | Kendi fazı, teknik yetkilisi ve aktiviteleri |

Bir müşteriye yeniden satış veya bir iş ortağıyla ikinci entegrasyon projesi başlayabilir. Bu nedenle yalnız `firma + müşteri/ortak` düzeyinde iki faz alanı uzun vadede yetmez; ayrı süreç/proje kayıtları gerekir.

## Aktivite türüne göre faz

Kullanıcı akışı: **Firma → Aktivite Kapsamı → İlgili Süreç → Görüşme Kanalı → Faz ve Notlar**.

- İş Ortağı Aktivitesi seçildiyse yalnız o kapsamın faz seti gelir.
- Müşteri/Satış Aktivitesi seçildiyse yalnız müşteri/satış faz seti gelir.
- İki ilişkili firmada kapsam seçilmeden faz tahmin edilmez. Kullanıcının yalnız bir kapsama yetkisi varsa o kapsam önceden seçilebilir.
- Telefon, e-posta veya online toplantı görüşme kanalıdır; firmanın müşteri mi ortak mı olduğunu belirlemez.
- Entegrasyon durumları mevcut İş Ortağı Aktiviteleri altında izlenir. Yeni üst seviye entegrasyon modülü kurulmaz.
- API aktivite türü, firma ilişkisi, süreç ve faz setinin birbirine uyduğunu doğrular. Arayüzde gizlemek tek başına yetkilendirme değildir.
- Düzenlemede türü değiştirmek başka süreçteki fazı sessizce değiştiremez; süreç taşıma ayrı yetki ve audit gerektirir.
- Pasife alınan ilişki veya faz geçmiş kaydı silmez. Mevcut süreçlerin kapatılması/yeniden açılması açık kurala tabi olur.

## Parametrik yetki

Mevcut Entra/AD kimliği ve CRM RBAC matrisi korunur. İş Ortağı firmanın ilişkisidir; Account Manager, ITSM ve Admin kullanıcının yetki rolleridir.

Aktivite türü tanımında rol bazlı **görüntüle, oluştur, düzenle, faz değiştir, sorumlu ata** izinleri ayrı yönetilir. Kapsam seçenekleri kendi kayıtları, üyesi olduğu süreç, ekibi ve tüm kayıtlar olarak ayrı modellenir. Kullanıcının genel işlem izni, ilgili tür izni ve kayıt kapsamı birlikte sağlanmalıdır. Tanımsız kural varsayılan olarak erişim vermez. Super Admin davranışı mevcut yetki modeliyle tutarlı kalır.

Faz seti yalnız faz adlarından oluşmaz: sıralama, geçiş yolları, gerekli alanlar ve geçiş yetkileri vardır. Birden fazla AD rolü bulunan kullanıcının yetkileri mevcut etkin izin birleşimiyle hesaplanmalı; yalnız birincil rolüne bakılmamalıdır. “Sorumlu Ekip” metni yetki kontrolü yerine kullanılamaz.

Parametre değişikliği kaydedilirken etkilenen açık süreç sayısı gösterilir. Kullanılmış fazın anlamını değiştiren düzenleme yeni şablon sürümü üretir; geçmiş aktivitenin faz adı/bağlamı sonradan yeniden yorumlanmaz. Kritik değişiklikler version kontrolü ve audit ile kaydedilir.

## Parametre ekranı

Ana gruplar işletme diliyle sunulmalı: Firma İlişkileri, Aktivite Türleri, Faz Akışları, Roller ve Yetkiler, İletişim ve Diğer Listeler. Jira/Entra bağlantı ayarları ayrı sistem alanında kalır.

Bir aktivite türünün detayında aynı yerde şu bölümler görünür: Genel Bilgiler, Kullanılabilecek Firma İlişkileri, Faz Akışı, Yetkili Roller, Zorunlu Alanlar. Örneğin İş Ortağı Aktivitesi açıldığında bağlı faz seti ve rol izinleri görünür. Kullanıcı bunları birbirinden kopuk teknik parametre gruplarında aramaz.

Günlük liste düzenlemede ad ve aktiflik yeterlidir. Sıra, kanonik kod ve kayıt değeri varsayılan tabloda gösterilmez. Yeni seçenek sona eklenir; gelişmiş alanlar ayrıca açılır. Faz sırası iş akışının parçasıdır; sıradan liste sırası ile karıştırılmaz. Mevcut `faz_no` kimlik olarak da kullanıldığı için kimliği değiştirerek görsel sıralama yapılmamalıdır.

Yerelde yapılan ilk düzenleme: büyük modül kartları yerine alan seçimi, tüm gruplarda arama, seçili alan sayaçları, dar ekranda panel/form boyutları, gelişmiş alanları gizleme, liste/faz/sistem ayarı editörlerinin API tarafından doğru seçilmesi. Tam süreç ve tür-yetki düzenleyicisi henüz uygulanmadı.

## Kaynaktaki dönüşüm noktaları

| Mevcut nokta | Sorun / dönüşüm |
|---|---|
| `app/api/crm/update/route.ts` | Tek `customer_type`; standard'a dönünce `is_ortagi_tipi` temizleniyor. Yerine bağımsız ilişki kayıtları |
| `app/api/activities/customers/route.ts` | `is_business_partner` firma türünden türetiliyor. Yetkili aktivite kapsamları dönmeli |
| `components/activities/QuickActivityClient.tsx` | Faz listesi firma türüne göre seçiliyor. Aktivite türü + süreçten seçilmeli |
| `app/api/activities/create/route.ts` | Faz tablosu firma türünden seçiliyor; aynı firma üzerindeki toplu tamamlama süreçle sınırlandırılmalı |
| `app/api/activities/list/route.ts` | Tarihsel aktiviteyi firmanın bugünkü türüyle sınıflandırmamalı |
| `musteri_pipeline` | Firma başına tek özet; bağımsız süreç özetlerine geçilmeli |
| `pipeline_eventleri.faz_no` | Standart faz kataloğu FK'sı ortaklık fazlarıyla karışıyor; süreç şablonu/sürümündeki stabil faz ID'sine bağlanmalı |
| `app/api/admin/parameters/route.ts` | Genel anahtar/değer yönetimi; ilişki, tür, akış ve yetki bağlantıları için alanlara özgü servisler gerekli |
| `app/api/admin/rbac/route.ts` | Mevcut permission matrisi korunarak tür/kapsam kontrolleri genişletilmeli |
| Haftalık raporlar ve satıcı özetleri | Firma türü yerine aktivitenin kendi kapsamına göre raporlama |

## Tek SQL dosyası ve geçiş

Yeni SQL mevcut `db/migrations/20260818_004_consolidated_schema_baseline.sql` dosyasının devamında tutulur. Bu çalışmada ayrı hazırlanan iki SQL dosyası kaldırılıp ana dosyaya taşındı. Önceki baseline metni byte düzeyinde korunur. `-- CRM_APPEND_MIGRATION:` bölüm başlıkları altında yeni değişiklikler ayrı sürüm/checksum ile takip edilir; `scripts/migrate.mjs` bunları diğer mevcut migration sürümleriyle tarih sırasında yürütür. Yeni SQL dosyası açmak gerekmez.

Önceden uygulanmış içerik veya bölüm değiştirilmez; yeni değişiklik sona eklenir. Bilinmeyen eski checksum farkı otomatik kabul edilmez. Canlı dağıtım öncesi canlı sürüm ve migration kayıtlarıyla uzlaştırma gerekir. Ana SQL dosyasının tamamını üretimde tekrar çalıştırmak mevcut seed ve veri düzenleme işlemlerini de çalıştırabilir; mevcut veri için sürüm kontrollü runner kullanılmalıdır.

Geçiş sırası: ilişki ve süreç tablolarını ekle → eski kimlikleri koruyarak açık eşlemeleri taşı → belirsiz geçmiş kayıtları inceleme listesine ayır → pilot karma firmada iki süreci uçtan uca doğrula → liste/rapor/teklif/forecast tüketicilerini taşı → eski alanları yalnız uyumluluk için tut. İki firmayı aynı isimden dolayı otomatik birleştirme yapılmaz.

Kabul örneği: ABC firmasının cihaz satışını tamamlamak, aynı firmanın entegrasyon fazını değiştirmez. Yetkisiz kullanıcı İş Ortağı Aktivitesi türünü göremez ve doğrudan API çağrısıyla da oluşturamaz. Firma iki filtrede yer alabilir, toplam firma sayısında bir kez sayılır. Geçmiş kayıtlar ve teklif tutarları geçiş öncesi/sonrası uzlaşır.
