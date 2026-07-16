# CRM Premium Full V3.19 - Geçmiş Kullanıcı Aktivite Raporu

## Düzeltilen ana konu
V3.18 raporu yalnızca aktif kullanıcı dizinine ve yeni kimlik kolonlarına fazla bağımlı görünüyordu. V3.19 raporu doğrudan mevcut `pipeline_eventleri` geçmişini tarar.

## Geçmiş veri kapsamı
- Mevcut `created_by` değerleri rapora dahil edilir.
- Aktif olmayan eski kullanıcılar kullanıcı seçiminde gösterilir.
- `allowed_users` ile eşleşmeyen eski `created_by` adları ayrı "Geçmiş kayıt" seçeneği olarak gösterilir.
- `created_by` boş eski satırlarda yalnızca son çare olarak `owner` alanı kullanılır ve ekranda veri kalitesi uyarısı gösterilir.
- Varsayılan tarih aralığı CRM'deki en eski aktiviteden bugüne ayarlanır.
- Firma account sahibi farklı olsa bile aktivite kaydı, aktiviteyi giren kullanıcı adına göre raporlanır.

## Yeni kayıtların korunması
- Yeni aktiviteler UUID ve e-posta creator kimliğiyle kaydedilir.
- Düzenleme ve tamamlama işlemleri `created_by` alanını değiştirmez.
- Son düzenleyen kişi ayrı `updated_by_*` alanlarında tutulur.

## Gerçekçi veri notu
Eski sürümlerde bazı güncelleme/tamamlama işlemleri `created_by` alanını son işlem yapan kişiyle değiştirmiş olabilir. Veritabanında ayrıca geçmiş audit kaydı yoksa bu satırların ilk oluşturan kişisi teknik olarak geriye dönük kesin biçimde üretilemez. Rapor, veritabanında bugün bulunan geçmiş creator bilgisini eksiksiz gösterir ve belirsiz fallback kayıtlarını açıkça işaretler.
