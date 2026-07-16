# Cross Account Edit Patch

Bu pakette account manager kullanıcılarının sadece kendi müşterisini/aktivitesini düzenleme kısıtları kaldırıldı.

## Değişenler
- Müşteri temel bilgisi ve sorumlu değişikliği artık onaya düşmeden direkt güncellenir.
- `musteriler.updated_by` ve `musteriler.updated_at` son işlem yapan kişiyi tutar.
- Künye güncelleme tüm CRM erişimli kullanıcılar için açıldı.
- `musteri_kunye_v2.updated_by` ve `updated_at` son künye güncelleyen kişiyi tutar.
- Aktivite tamamla/güncelle tarafında `created_by == kullanıcı` kısıtı kaldırıldı; güncelleyen kişi mevcut `created_by` alanına yazılır.
- Pipeline event ekleme tarafında müşteri sorumlusu kontrolü kaldırıldı.
- Teklif liste/detail/update/status/pdf tarafındaki owner kısıtları kaldırıldı.

## Deploy
Önce çalıştır:

```sql
sql/cross_account_edit_patch.sql
```
