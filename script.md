# script.md

## Yapılacaklar
- Yönetici Sunumu `Temas Edilen Müşteriler` slaytında hedef gösterimi Satışçı Sunumu ile aynı olacak: kişi satırları, üst info kartları ve `Toplam` satırı hedef 0'dan büyükse `gerçekleşen / hedef` formatında gösterilecek; toplam hedefler kişi hedeflerinin toplamı olarak hesaplanacak.
- Yönetici Sunumu kişi satırlarında hedefli hücreler renklendirilecek: gerçekleşen hedefin altındaysa kırmızı, hedefe eşitse mavi, hedefi geçtiyse yeşil; üst info kartları ve `Toplam` satırında renklendirme yapılmayacak.
- Kullanıcılar ekranında haftalık temas hedefleri tabloyu büyütmeden `Hedefleri Düzenle` popup/modal ekranından yönetilecek.
- Haftalık hedef popup/modal içinde `Toplam Aktivite` hedefi de ayrıca yönetilecek; bu hedef diğer hedeflerin otomatik toplamı kabul edilmeyecek.
- PPTX temas edilen müşteriler alanında hedef değeri 0 olan kolonlarda `/ 0` gösterilmeyecek, sadece gerçekleşen sayı gösterilecek.
- Kullanıcılar ekranında account bazlı haftalık temas hedefleri yönetilecek.
- Temas Edilen Müşteriler slaytında gerçekleşen değerler hedef varsa `gerçekleşen / hedef` formatında gösterilecek.
- Yönetici Sunumu ve Satışçı Sunumu aynı hedef/gerçekleşen mantığını kullanacak; mevcut rapor filtreleri ve Jira/Pipeline aggregation mantığı bozulmayacak.
- Jira Retail Support PPTX slaytında başlık, KPI kartları ve tablo okunur olmalı; çok satır varsa veri sıkıştırılmayacak, ikinci/sonraki slaytlara bölünecek.
- Jira Retail Support verileri seçili tarih aralığında oluşturulan veya seçili tarih aralığında güncellenen ticketlardan hesaplanmalı.
- `Oluşturulan` yalnızca seçili tarih aralığında oluşturulan ticketları saymalı.
- `Kapatılmış` kolonuna `Çözüldü`, `Kapatılmış`, `İptal Edildi`, `Resolved`, `Closed`, `Canceled/Cancelled` statüleri alınmalı.
- `Devam Eden` kolonuna `Devam Ediyor`, `Destek bekleniyor`, `In Progress`, `Waiting for Support` statüleri alınmalı.
- `Geliştirme Bekl.` kolonuna `Geliştirme Bekliyor`, `Waiting for Development` statüleri alınmalı.
- `Müşteri Bekl.` kolonuna `Müşteri bekleniyor`, `Waiting for Customer` statüleri alınmalı.
- PPTX indirme öncesi ekrandaki Jira ön izleme ile PPTX çıktısı aynı özet mantığını kullanmalı; PPTX yerleşim düzeltmeleri Jira veri çekme/aggregation mantığını değiştirmemeli.
- Retail Support PPTX arka planda eski şablon tablo/grid kalıntısı bırakmayacak şekilde temiz/okunur oluşturulmalı.
- Retail Support PPTX okunurluk için maksimum 14 firma satırı + genel toplam kullanmalı; daha fazla firma varsa sıkıştırmadan yeni slayta bölmeli.
- Retail Support PPTX düzeninde Jira veri çekme ve aggregation koduna dokunulmayacak; sadece slayt yerleşimi değiştirilecek.

- Retail Support PPTX diğer sunum sayfalarıyla uyumlu olacak: üst boşluk azaltılacak, başlık sol hizalı/okunur olacak, KPI kartları başlığa yakın ama tabloyla çakışmayacak.
- Retail Support PPTX fontları okunabilir tutulacak; satır sayısı artarsa font küçültmek yerine daha fazla slayta bölünecek.
- Retail Support PPTX sayfalama limiti okunurluk için 14 firma satırı + genel toplam olacak; veri/aggregation mantığına dokunulmayacak.

- Genel durum raporu slaytlarında üst bilgi kartları ile tablo arasında boşluk bırakılmayacak; tüm ilgili slaytlarda aynı hizalama/başlangıç çizgisi kullanılacak.
- Jira Retail Support slaytında üst bilgi alanı kompaktlaştırılacak; okunurluk bozulmadan bir sayfada gösterilen firma satırı sayısı artırılacak.

- Retail Support PPTX alt sağ PAX logosu ve alt dekor korunacak; temizleme katmanı footer alanını kapatmayacak.
- Retail Support PPTX başlığında `Retail Support Ekibi` yazımı kullanılacak; `EKİBİ` tamamı büyük harf formatı kullanılmayacak.

- İş ortakları `musteriler` tablosunda `sektor = İŞ ORTAĞI`, `sorumlu = İş Ortakları`, `entegrasyon_tipi = NULL` olarak tutulacak.
- İş ortakları müşteri listesi, müşteri filtreleri, müşteri ekleme/düzenleme sorumlu/sektör seçenekleri ve aktivite müşteri seçimlerinde görünecek.
- İş ortakları Seda Kesikoğlu / Cem Koç kapsamındaki rapor müşterileri gibi fazsız takip edilecek; künye/faz/pipeline zorunluluğu oluşturmayacak.
- İş ortaklarında account aktiviteleri iş ortağına özel faz tanımlarını kullanarak ilerler; Teknik Online, Teknik Ziyaret ve POM faz değiştirmez.
- İş ortağında faz yoksa teknik aktivite sırasında kullanıcıya "Accountlara haber veriniz" uyarısı gösterilir.
- `sql/business_partner_report_only_customers.sql` iş ortaklarını eklemek/güncellemek için kullanılacak.

## Değiştirilmeyecek Kurallar
- Bu dosyanın zorunlu başlıkları `Yapılacaklar` ve `Değiştirilmeyecek Kurallar` olarak kalacak.
- Projede değişiklik yapmadan önce bu dosya okunacak.
- Çalışan CRM yapısı, login/yetki yapısı ve mevcut rapor akışı bozulmayacak.
- DB enum değerleri ve daha önce sabitlenen UI/DB birebir değerleri değiştirilmeden korunacak.
- Jira token, email veya hassas `.env` değerleri zip içine gerçek değerleriyle eklenmeyecek.
- Jira firma alanı varsayılan olarak `customfield_10002` kabul edilecek; env ile gelen değer varsa öncelik onda olacak.
- Jira REST/JSM debug bilgileri tamamen kaldırılmayacak; sorun olduğunda teşhis edilebilir kalacak.
- Yönetim sunumu ve faz raporları rapor-harici/Banka/Vertical/İş Ortağı kayıtlarını pipeline müşterisi gibi saymayacak.
