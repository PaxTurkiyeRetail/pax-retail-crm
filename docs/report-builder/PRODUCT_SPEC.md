# Rapor Merkezi — ürün kararı ve sürüm kabulü

Tarih: 19 Ekim 2026. Durum: uygulama ve kabul kapsamı; bu belge tek başına özelliklerin teslim edildiği anlamına gelmez.

## Ürün hedefi

Kullanıcı kendi iş sorusunu, geliştiriciden yeni rapor istemeden, erişebildiği CRM alanlarıyla yanıtlayabilmeli. Hazır raporlar başlangıç örnekleridir; özelleştirmenin sınırı değildir. Başarı ölçütü: kullanıcı boş bir rapordan kendi alanlarını seçer, sonucu doğrular, kaydeder ve aynı tanımı yeniden açar.

İki eşit derecede görünür giriş bulunmalı: **Hızlı rapor** (üç adımlı tek sorgu sihirbazı) ve **Özel rapor oluştur** (çok bölümlü çalışma alanı). Özel rapor, tek sorgunun daha karmaşık formu olmamalı: kullanıcı aynı belgeye başlık, açıklama, KPI, tablo, pivot ve grafik bölümleri ekleyebilmeli; her veri bölümünün kaynağını ve alanlarını ayrı seçebilmeli. Özel rapor için kullanıcının “uzman” olduğunu düşünmesi veya alt menü keşfetmesi gerekmemeli.

## Bu sürümde öncelik

| Öncelik | Teslim davranışı | Kabul koşulu |
|---|---|---|
| P0 | Özel rapor çalışma alanına doğrudan giriş | Galeriden tek tıkla açılır; şablon seçmek zorunlu olmaz. |
| P0 | Tüm izinli alanları keşfetme | Kaynak açıklaması, aranabilir ölçü/kırılım listesi ve alan açıklamaları görünür; kısa öneri listesi tüm alanların yerini almaz. |
| P0 | Kendi rapor yapısını kurma | En çok 12 ölçü, 4 sıralı kırılım seçilir; kaldırılır ve sırası değiştirilir. Tarih kırılımında desteklenen gün/hafta/ay/çeyrek/yıl seçilir. |
| P0 | Veri kapsamını açıkça belirleme | Departman, tüm dönem/göreli dönem/özel tarih, alan tipine uygun filtreler seçilir. Filtrelerin birlikte VE ile uygulandığı belirtilir. |
| P0 | Anlaşılır önizleme ve kayıt | Boş sonuç/hatalı seçim ayrı açıklanır; sonucun dönemi ve satır limiti görünür. Kaydet, güncelle ve kopya kaydet ayrıdır. Yeniden açınca tüm seçimler korunur. |
| P1 | Analiz kontrolleri | Sıralama alanı/yönü, satır limiti, önceki dönem/geçen yıl karşılaştırması, tablo/grafik/pivot/ısı tablosu uygun alanlarla çalışır. |
| P1 | Hesap ve biçim | En çok 6 hesaplanmış ölçü; seçilen ölçülere referansla formül ve örnek. Koşullu renkler kaydedilip yeniden açıldığında aynı görünür. |
| P1 | Çıktı ve yeniden kullanım | Geçerli tanımdan CSV/PDF alınır; paylaşılan rapor düzenlenemiyorsa kişisel kopya oluşturulur. |

Alan seçiminin yanındaki özet iş dilinde olmalı: “Retail · bu yıl · ay ve satıcı bazında · cihaz adedi ve USD ciro”. Kullanıcının teknik alan anahtarlarını öğrenmesi zorunlu olmamalı. Önizleme eski bir sorguya aitse bunu güncel sonuç gibi göstermemeli.

## Mevcut motorun gerçek sınırları

Kaynaklar: Satışlar (`sales`), satış kalemleri (`sale_items`), Forecast, Aktiviteler, Müşteriler ve Teklifler ile Hizmet faturası kalemleri (`service_invoice_items`). Kaynak kataloğu kullanıcı izinleriyle sınırlandırılır. Müşteri, sorumlu, sektör ve departman gibi ortak alanlar kaynakların mevcut semantik bağlantılarıyla zaten gelir.

Tek rapor tanımı **bir kaynak** kullanır. Mevcut motor; çoklu ölçü/kırılım, tarih, VE filtreleri, kaynak içi hesaplanmış ölçü, karşılaştırma, sıralama ve limit destekler. Güvenli formüller aritmetik, IF, DIV/PCT, SHARE, RANK ve kümülatif hesapları kapsar. Kullanıcı SQL yazmaz. Kullanıcının kayıtlı rapora erişmesi, kaynak/satır yetkilerini genişletmez.

Çok bölümlü belge mevcut `PageDefinition` modelini kullanır; her veri bölümü yukarıdaki tek kaynaklı sorgulardan biridir. Aynı belgede farklı kaynakların bulunması satır bazında birleştirme değildir. Bölüm ekleme, çoğaltma, silme ve sıralama ile belgenin tamamını kaydetme/yeniden açma bu ürünün temel kabulüdür.

## Düzenlenebilir başlangıç raporları

- `kasapos_monthly`: dönem toplam KPI'ları, firma × ay faturalanan adet pivotu, ayrı USD gelir pivotu ve aylık adet/gelir çizgileri. KasaPOS entegrasyon kalemi filtresi her bölümde korunur. Toplam adet dönem boyunca kasa-ay toplamıdır; aktif cihaz stoku değildir. Kaynak tarihler göreli “bu yıl”dır.
- `retail_custom`: Retail satış özeti, aylık satış, Forecast dağılımı, satıcı tablosu, güncel CRM dağılımı ve aylık KasaPOS USD bölümü. Her bölüm düzenlenebilir; cihaz forecast'i hizmet faturası forecast'i gibi gösterilmez. CRM stok bölümü dönem filtresinden bağımsızdır.

KasaPOS PDF referansı beş bölüm içerir: son ay özeti ve fırsatlar; aylık adet/tutar değişimi; firma-ay adet; firma-ay USD; aktif/faturalanan/kullanım/fırsat/potansiyel tablosu. Başlangıç raporu firma-ay tabloları ve iki trende ek olarak yeni `kasapos_snapshot` kaynağından anlık stok/kullanım/fırsat/potansiyel KPI'ları ve firma tablosu üretir. Bu kaynak son entegrasyon fatura ayının yılındaki faturalı firmaları birer satır olarak alır; Künye'nin güncel sayısal kasa değeri, yoksa müşteri aktif kasa değeri kullanılır. Fatura kalemleri müşteri/ay düzeyinde önceden toplanarak stok mükerrer sayılmaz. Stoku bilinmeyen firmalar kullanım pay/paydasına girmez; fiyatı bilinmeyen fırsat için gelir türetilmez. Fırsat geliri özel KasaPOS raporuyla aynı son pozitif faturalı ayın yuvarlanmış USD birim tutarı kuralını kullanır; döviz dönüşümü yapılmaz. Anlık bölümler tarih filtresinden bağımsızdır ve geçmiş stok yeniden kuruluyormuş gibi sunulmaz. PDF'deki müşteri ve tutar anlık görüntüleri uygulamaya gömülmez. Grafiklerin görsel yerleşimi ve birebir PDF dizgisi ayrıca doğrulanmalıdır.

Farklı kaynakları aynı panoda ayrı kartlarla göstermek mümkündür. Satış ile Forecast'i müşteri/model/ay üzerinden birleştirip aynı tabloda gerçekleşen/hedef/oran üretmek ise serbestçe desteklenen bir rapor işlemi değildir. Böyle bir ürün için ortak anahtarlar, veri tanesi, eksik eşleşme davranışı, toplama kuralları ve birleşim sonrası yetkiler ayrıca tasarlanmalı. Bu sürüm “tüm verileri istediğin gibi birleştir” sözü vermemeli.

İç içe VE/VEYA grupları, ham satır düzenleme, yeni veri kaynağı ekleme ve zamanlanmış gönderim bu çalışma alanının mevcut yetenekleri diye sunulmaz. Kaynak değiştirmek uyumsuz seçimleri sıfırlayabilir; kullanıcıya görünür olmalı ve eski sonuç temizlenmeli.

## Kabul akışları

Anlık KasaPOS bölümleri tüm sayfa filtrelerinden bağımsızdır; kaynak tanımını düzenleyerek ayrıca kapsamlandırılır. Fırsat gelirinin fiyatı bilinen firmalar üzerinden hesaplandığı başlıkta belirtilir; stoku bilinen firma sayısı ile stoku ve USD fiyatı bilinen firma sayısı birlikte gösterilir. Retail CRM stok bölümünde sayfa filtreleri atlandığı için `department: Retail` sorguda ayrıca sabittir.

1. **Özgün satış analizi:** Özel rapor → Satışlar → cihaz adedi + USD ciro → ay + satıcı → Retail + bu yıl → geçen yıl karşılaştır → çizgi/tablo → isimle kaydet. Yeniden açıldığında alanlar, sıralama, dönem ve karşılaştırma aynıdır.
2. **Model ve sektör:** Satış kalemleri → ürün kodu + sektör → adet + USD tutar → para birimi USD → tutara göre azalan sıralama. Kullanıcı sadece önerilen kırılımlara hapsolmaz. USD tutar ile tüm döviz adetlerinden türetilen ortalama örneği verilmez; örnek fiyat formülü USD kapsamıyla sınırlandırılır.
3. **Aktivite iş yükü:** Aktiviteler → giren kişi + aktivite tipi → aktivite sayısı → son 30 gün → birden fazla tip için “listede” filtresi → CSV. Boş listede anlamlı mesaj çıkar; teknik nesne/metin hatası gösterilmez.
4. **Kendi hesabı:** Satışlar → USD ciro ve cihaz adedi, para birimi USD → ortalama fiyat formülü → sıfır paydada çökmeyen önizleme → eşik altında koşullu renk → kaydet ve yeniden aç. Görsel kural ve formül korunur.
5. **Kopyayla ilerleme:** Paylaşılan raporu aç → kopya kaydet → tarih/alan değiştir → yeni adla kaydet. Kaynak rapor değişmez; kişisel kopya Raporlarım'da görünür.
6. **Sınırın doğru anlatılması:** Tek tabloya satış ve aktivite ölçülerini birlikte koymak isteyen kullanıcıya mevcut kaynak alanları gösterilir; olmayan bir birleşim seçeneği sunulmaz. Ayrı kaynak kartları için pano oluşturma yolu açıklanır.

## Yayın kapısı

Tip kontrolü, ilgili derleyici/formül/kalıcılık testleri ve üretim derlemesi geçmeli. Tarayıcıda en az boş başlangıç, özel alan seçimi, filtre, önizleme ve yeniden açılan kayıt akışı doğrulanmalı. Mock veriyle yapılan doğrulama canlı kayıt/AD doğrulaması olarak raporlanmaz. Üretime geçiş ayrıca proje onay sürecine tabidir.


## 19 Ekim son yönlendirmeler
- Kiralama girişi mevcut Teklifler → Satışlar akışında kalır. Ayrı kiralama giriş ekranı bu teslimattan çıkarıldı.
- 12 eşzamanlı kırılım; model, müşteri, Account, kanal, departman ve tarih aynı kaynak içinde birleştirilebilir. Keyfi kaynaklar arası join destekleniyor diye sunulmaz.
- Kolay başlangıç konu/rakam/kırılım seçimiyle özet ve tablo oluşturur; Operasyon Paneli başlangıcı beş düzenlenebilir sekme üretir.
- Rapor ayarlarında sol menüde göster seçimi rapor JSON tanımına kaydedilir; yalnız mevcut paylaşım yetkileriyle listelenir. Menü canlı önizlemeyi açar; sorgular her açılışta yeniden çalışır.
- Kurumsal antet PDF arka planı olarak korunur; dikey A4 oranı sabittir. Antetsiz ve yüklenen antet seçenekleri korunur.

## Son ürün düzeltmesi
Operasyon Paneli yalnız kabiliyet örneğidir. Yeni rapor akışında sabit Retail/KasaPOS kartları yoktur. Kullanıcı her bölümü kaynak/rakam/kırılım/dönem/görünüm seçerek kendisi kurar; tek sayfa veya sekmeli düzen seçer. Rapor Merkezi sabit panel kopyalama alanı değildir. Mevcut sol menü raporları korunur. Sahip olunan hızlı raporlar ve düzenleme yetkili özel sayfalar onaylı Sil işlemiyle arşivlenir; menü ve kayıtlı erişim kapanır.
