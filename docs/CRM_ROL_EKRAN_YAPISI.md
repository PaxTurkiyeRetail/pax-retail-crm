# Rol ve Ekran Erişim Yapısı

## Genel mantık

Giriş: Entra ID (AD). Kullanıcı manuel oluşturulmaz — AD'de tanımlı Security Group,
Entra Enterprise App üzerinde bir **App Role**'e atanmıştır (crm.super_admin,
crm.admin, crm.itsm, crm.account_manager, crm.user). Kullanıcı giriş yaptığında bu
App Role token'da gelir, CRM tarafında 5 sabit role çevrilir (`system_oidc_app_role_mapping`
parametresi ile eşleştirilir), hesap yoksa otomatik oluşturulur (JIT).

AD taraf: kim hangi grupta → bilgi orada, biz karışmayız.
CRM taraf: o rol hangi ekranı görür → biz burada yönetiriz.

## 5 sabit rol

- `super_admin` — her şey, değiştirilemez, sabit tam yetki
- `admin` — super_admin ile aynı, sadece Rol Yönetimi ve Kimlik Sağlayıcı Yönetimi hariç
- `account_manager` — kendi müşteri/teklif/aktivite/forecast'ı
- `itsm` — parametre yönetimi + operasyon + talep yönetimi
- `user` — sadece kendi talepleri

## Ekran ↔ Yetki eşlemesi

| Ekran (modül) | Yetki adı (DB) | Ne işe yarar |
|---|---|---|
| Müşteriler | `crm` grubu | Müşteri görüntüleme/oluşturma/güncelleme/atama |
| Aktiviteler | `activity` grubu | Aktivite görüntüleme/oluşturma/teknik aktivite |
| Teklifler | `quote` grubu | Teklif görüntüleme/oluşturma/durum/katalog yönetimi |
| Forecast | `forecast` grubu | Forecast görüntüleme/yazma |
| Raporlar | `report` grubu | Rapor görüntüleme (own/team/all) |
| Talepler | `request` grubu | Talep oluşturma/görüntüleme/yönetim |
| Kullanıcı Yönetimi | `admin.users.manage` | admin/users ekranı |
| Parametre Yönetimi | `admin.parameters.manage` | admin/parameters ekranı |
| DB Yedeği | `admin.backup.execute` | admin/db-backup ekranı |
| Rol ve Yetki Yönetimi | `admin.rbac.manage` | admin/rbac ekranı (sadece super_admin) |
| Kimlik Sağlayıcı Yönetimi | `admin.identity.manage` | OIDC/Entra ayarları (sadece super_admin) |

## Nerede yönetiliyor

**admin/rbac** ekranı (`app/(panel)/admin/rbac`) — rol x yetki matrisi, checkbox ile
aç/kapa. `admin.rbac.manage` yetkisi olmadan (yani super_admin dışında) girilemez.
Değişiklik anında `rbac_role_permissions` tablosuna yazılır, aynı anda `lib/roles.ts`
içindeki statik varsayılan tabloya (DB boşsa/yoksa devreye giren fallback) dokunulmaz.

Kod tarafında her ekranın `page.tsx`'i zaten hangi yetkiyi istediğini söylüyor
(`requireCrmAccessOrThrow`, `requireReportsAccessOrThrow` vb. → `lib/authz.ts`).
Yani "hangi rol hangi ekranı görür" sorusunun cevabı = admin/rbac ekranındaki
checkbox'lar. Yeni bir sayfa eklenince oraya da bir yetki eklenir, aynı mantık sürer.

## Mevcut kayıtlar bozulmaz

Local login (email/şifre) kullanıcıları `allowed_users` tablosunda aynen duruyor,
JIT sadece AD ile girenler için devreye giriyor. Var olan kullanıcı role'ü elle
değiştirilmedikçe dokunulmaz.
