# Kullanıcı Aktivite Sunumu - V3.19

## Geçmiş rapor düzeltmesi

Bu sürüm yalnızca yeni oluşturulan aktiviteleri değil, CRM'de daha önce kaydedilmiş `pipeline_eventleri` geçmişini de doğrudan raporlar.

- Aktif ve pasif kullanıcılar seçim listesine dahil edilir.
- `allowed_users` ile eşleşmeyen eski `created_by` değerleri ayrı "Geçmiş kayıt" seçeneği olarak gösterilir.
- Tarih aralığı varsayılan olarak sistemdeki en eski aktiviteden bugüne gelir.
- Firma account sahibi farklı olsa bile aktivite, kayıtta bulunan aktiviteyi giren kullanıcı bilgisine göre raporlanır.
- Yeni kimlik kolonları henüz canlı veritabanında yoksa rapor yine eski `created_by` alanından çalışır.
- `created_by` boş eski satırlarda son çare olarak `owner` kullanılır ve bu durum veri kalitesi uyarısıyla gösterilir.

## Erişim

Yalnızca `admin` ve `super_admin` rollerine açık:

- `/crm/reports/user-activity-presentation`
- `/api/reports/user-activity-presentation`
- `/api/reports/user-activity-presentation/pdf`

## SQL migration

`sql/user_activity_creator_identity.sql` raporun geçmiş verileri okuyabilmesi için zorunlu değildir. Ancak yeni aktivitelerde ilk oluşturan kişinin değişmez şekilde saklanması ve güvenli eşleşebilen eski satırların UUID/e-posta ile zenginleştirilmesi için canlıda çalıştırılmalıdır.

## Veri sahipliği sırası

1. `created_by_user_id`
2. `created_by_email`
3. Eski `created_by` metni
4. Yalnızca `created_by` boşsa `owner` fallback'i

## Geçmiş veriye ilişkin teknik sınır

Eski sürümlerde bazı aktivite güncelleme veya tamamlama işlemleri `created_by` alanını son işlem yapan kişiyle değiştirmiş olabilir. Ayrı bir audit geçmişi yoksa bu satırların ilk oluşturan kişisi veritabanından kesin biçimde geri üretilemez. V3.19, veritabanında bugün mevcut olan tüm geçmiş creator kayıtlarını rapora dahil eder ve belirsiz fallback kayıtlarını açıkça işaretler.
