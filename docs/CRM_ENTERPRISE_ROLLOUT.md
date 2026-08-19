# CRM Kurumsal Geçiş ve Yayın Planı

Tarih: 16 Ağustos 2026

Bu çalışma canlı veritabanına uygulanmadı. Kod, migration ve kalite kapıları hazırlandı; üretim geçişi aşağıdaki sırayla yapılmalıdır.

## 1. Yayın sırası

1. Üretim veritabanının doğrulanmış `pg_dump --format=custom` yedeğini alın ve ayrı depolamada geri yükleme testi yapın.
2. Bakım penceresinde mevcut rol değerlerini kontrol edin:
   `select role, count(*) from public.allowed_users group by role order by role;`
3. Staging ortamında `npm ci`, ardından `npm run db:migrate` çalıştırın.
4. Staging üzerinde yerel giriş, şifre sıfırlama, müşteri/teklif sahipliği ve talep kapsamı testlerini tamamlayın.
5. Üretimde aynı migration komutunu tek instance üzerinden çalıştırın. Runner advisory lock ve checksum kullanır; aynı migration ikinci kez uygulanmaz.
6. Yeni uygulama sürümünü yayınlayın ve bütün instance'ları yeniden başlatın. Token kolon desteği başlangıçta algılandığı için restart zorunludur.
7. `/api/health`, giriş, çıkış, teklif oluşturma ve talep görüntüleme smoke testlerini çalıştırın.

İlk migration expand-first tasarlanmıştır: hash kolonları eklenirken mevcut düz token kolonları geçici olarak korunur. Bu nedenle migration sonrası uygulama geri dönüşü mümkündür; düz token kolonlarının temizliği ancak yeni sürüm doğrulandıktan sonra ayrı bir contract migration ile yapılmalıdır. Veri içeren kolonlar geri dönüş sırasında silinmemeli, forward-fix tercih edilmelidir.

## 2. Yetki modeli

| Rol | CRM | Teklif | Rapor | Talepler | Parametre | Kullanıcı | DB yedeği |
|---|---|---|---|---|---|---|---|
| `user` | Yok | Yok | Yok | Kendi açtığı/atandığı | Yok | Yok | Yok |
| `account_manager` | Mevcut rollout'ta tümünü okur, kendi kaydını yazar | Mevcut rollout'ta tümünü okur, kendi kaydını yazar | Tümü | Kendi açtığı/atandığı | Yok | Yok | Yok |
| `itsm` | Salt okunur tümü | Salt okunur tümü | Tümü | Tümü ve yönetim | Var | Yok | Yok |
| `admin` | Tümü | Tümü | Tümü | Tümü ve yönetim | Var | Var | Var |
| `super_admin` | Tümü | Tümü | Tümü | Tümü ve yönetim | Var | Var | Var |

Yetki kontrolleri `lib/roles.ts`, kullanıcı doğrulaması `lib/authz.ts` üzerinden yürür. Yeni API'lerde rol adı karşılaştırması yazılmamalı; permission kullanılmalıdır. Sahiplik için kalıcı anahtar `owner_user_id`'dir. İsim alanları yalnız geçiş ve gösterim içindir.

## 3. Auth ve Active Directory

Kurumsal giriş OIDC Authorization Code + PKCE kullanır. Uygulama AD parolası toplamaz. Koruma katmanları:

- `state`, `nonce`, PKCE S256 ve imzalı, 10 dakikalık işlem cookie'si;
- issuer, audience ve JWKS imza doğrulaması;
- yalnız `allowed_users` içinde aktif ve önceden tanımlı kullanıcıların bağlanması;
- provider/tenant/subject için kalıcı `auth_identities` eşlemesi;
- AD grup kimliği → CRM rolü için `auth_group_role_mappings`;
- grup senkronizasyonu açıkken eşleşmeyen kullanıcının `user` rolüne düşürülmesi;
- hash'li oturum ve reset tokenları, giriş hız sınırı ve append-only audit izi.

Entra ID uygulamasında redirect URI tam olarak `https://CRM_HOST/auth/callback` olmalıdır. Üretim örneği:

IT ekibinden aktivasyon öncesinde aşağıdaki bilgiler alınmalıdır:

- Microsoft Entra tenant ID ve doğrulanmış issuer adresi;
- application/client ID;
- client secret veya kurumun tercih ettiği sertifika bilgisi, sahibi ve son kullanma tarihi;
- staging ve production için ayrı, birebir eşleşen HTTPS callback adresleri;
- CRM rollerine bağlanacak AD gruplarının değişmeyen object ID değerleri ve grup sahipleri;
- token içinde `email`/`preferred_username`, `name`, `oid`, `tid` ve gerekiyorsa `groups` claim'lerinin sağlandığına dair örnek pilot token çıktısı;
- uygulamaya erişecek pilot kullanıcı listesi ve her kullanıcının beklenen CRM rolü;
- reverse proxy'nin gerçek dış protokol/host bilgisini nasıl ilettiği ve forwarded header'ları dış istemciden temizlediği bilgisi;
- secret yenileme, grup üyeliği değişikliği, erişim iptali ve acil break-glass süreçlerinin sorumluları.

Secret değeri veya token örneği e-posta/doküman içine düz metin yazılmamalı; onaylı secret manager üzerinden teslim edilmelidir. AD grup adları karar anahtarı değildir; `auth_group_role_mappings.external_group_id` alanına yalnız değişmeyen object ID kaydedilir.

```env
NEXT_PUBLIC_OIDC_ENABLED=true
OIDC_ISSUER=https://login.microsoftonline.com/TENANT_ID/v2.0
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_STATE_SECRET=<en az 32 karakter kriptografik rastgele değer>
OIDC_SYNC_GROUP_ROLES=true
TRUST_PROXY_HEADERS=true
AUTH_COOKIE_SECURE=true
```

Yerel (email/parola) giriş mimari olarak kalıcı kapalıdır — `AUTH_LOCAL_LOGIN_ENABLED`
gibi bir env flag ile tekrar açılamaz, böyle bir flag artık okunmuyor. `/api/auth/login`,
`/api/auth/forgot-password`, `/api/auth/reset-password` her koşulda `410 LOCAL_AUTH_DISABLED`
döner; local session oluşturmaz, parola değiştirmez, başka bir auth yoluna fallback etmez.
`allowed_users.password_hash` kolonu canlı veri korunduğu için drop edilmedi, ama artık
kimlik doğrulama kaynağı değildir. Tek giriş yolu kurumsal (Entra) OIDC'dir.

AD/OIDC iki ayrı DB parametresiyle ayrıca fail-closed korunur. IT bilgileri gelene kadar
`system_oidc_enabled=false` ve `system_oidc_group_role_sync_enabled=false` kalmalıdır.
Önce ortam bilgileri ve callback testi tamamlanır, sonra kurumsal giriş; grup eşlemeleri
ayrıca doğrulandıktan sonra grup-rol senkronizasyonu açılır. Bu parametreleri yalnız
`super_admin` değiştirebilir.

Entra kullanıcısı 200'den fazla gruptaysa token grup overage akışı oluşabilir. Bu durumda Graph tabanlı grup çözümleme ayrıca eklenmeden `OIDC_SYNC_GROUP_ROLES=true` yapılmamalıdır; uygulama güvenli biçimde girişi reddeder.

## 4. Güvenlik ve işletim

- Reverse proxy HTTPS zorlamalı, HSTS yalnız HTTPS doğrulandıktan sonra açık tutulmalıdır.
- `TRUST_PROXY_HEADERS=true` yalnız güvenilir proxy istemciden gelen forwarded header'ları temizliyorsa kullanılmalıdır.
- `OIDC_STATE_SECRET`, DB parolası ve istemci secret'ı secret manager'da tutulmalı; `.env` repoya eklenmemelidir.
- Audit tablosu uygulama seviyesinde append-only'dir. Saklama/arsivleme ayrı yetkili bakım rolüyle tasarlanmalıdır.
- Backup API `admin.db.backup` yetkisine sahip `admin` ve `super_admin` içindir; sunucu yolu istemciye dönmez. Otomatik, şifreli, dış depolamalı backup ayrıca kurulmalıdır.
- CI; typecheck, lint, test, production build ve production dependency audit çalıştırır.
- Mevcut lint çıktısındaki 93 uyarı yeni hata değildir fakat teknik borçtur. Yeni PR'larda uyarı sayısı artırılmamalı; modül modül sıfıra indirilmelidir.

## 5. Mobil ve web

Uygulama installable manifest ve mobil viewport bilgisine sahiptir. Hassas CRM verisi service worker ile offline cache'e alınmamıştır. Bu bilinçli güvenlik tercihidir.

- Web için 360, 390, 768, 1024 ve 1440 px smoke testleri zorunlu olmalıdır.
- Tablolar küçük ekranda kart görünümüne dönüştürülmeli; yalnız yatay scroll kalıcı çözüm sayılmamalıdır.
- Native dağıtım istenirse Capacitor kabuğu ayrı paket olarak kurulmalı; oturum cookie davranışı, universal/app links, MDM, ekran görüntüsü politikası ve minimum sürüm zorlaması ayrıca test edilmelidir.
- Mobil cihazda token WebView local storage içinde tutulmamalıdır.

## 6. Sonraki güvenli geliştirme dilimleri

1. Kalan aktivite, forecast, PDF ve rapor API'lerinde aynı sahiplik helper'larını eksiksiz uygulamak.
2. Talep create/update işlemlerini tek DB transaction'a taşımak.
3. Yeni şema değişikliklerini yalnız migration ile yapmak; runtime DDL yasağını CI kontrolüyle korumak.
4. Audit görüntüleme, alarm ve merkezi log/Sentry/Datadog entegrasyonu eklemek.
5. Playwright ile rol bazlı E2E test matrisi ve mobil ekran regresyon testleri kurmak.
6. AD pilotundan sonra local auth kapatma ve break-glass `super_admin` hesabı prosedürünü yazılı/onaylı hale getirmek.

Katman sınırları ve parametrik RBAC standardı için `CRM_TARGET_ARCHITECTURE.md` esas alınmalıdır.

## 7. Parametrik ana veri geçişi

Bu sürümde sektör, entegrasyon tipi, satış olasılığı, müşteri tipi, pipeline politikası, teklif olasılığı, aktivitede bekleyen taraf ve varsayılan sayfa boyutu merkezi kataloğa bağlanmıştır. Müşteri sahibi UUID ile seçilir; kişi adı parametre veya iş kuralı değildir.

Canlı geçiş sırası:

1. `20260816_001_enterprise_security_foundation.sql`, `20260816_002_parametric_master_data.sql` ve `20260817_003_parameter_catalog_seed.sql` staging'de checksum'lı runner ile uygulanır.
2. Backfill sonrası `customer_type`, `pipeline_policy`, `integration_type_key` ve aktif parametre gruplarının sayıları doğrulanır.
3. Admin Parametre Yönetimi ekranında her zorunlu grubun en az bir aktif değeri olduğu kontrol edilir.
4. `report.read.all` yalnız şirket geneli rapor görmesi gereken rollere verilir. `report.read.own/team`, satır kapsamlı rapor uçları tamamlanana kadar verilse bile global uçları açmaz.
5. Jira/PPTX bayrakları mevcut canlı davranışı korumak için açık seed edilir; Jira ortam bilgileri eksikse entegrasyon güvenli hata döndürür. AD/OIDC bayrakları ise kapalı gelir.
6. Uygulama migration'dan sonra yayımlanır; eski uygulama sürümü yeni parametre kodlarını yazmamalıdır.

Geri dönüşte kolon veya katalog satırı silinmez. Uygulama önce önceki uyumlu sürüme alınır; sorunlu yeni katalog değerleri pasife çekilir. Veri kaybı yaratacak ters migration yerine forward-fix kullanılır.

## 8. Filtre ve ürün denetimi

Ekran bazlı filtre tutarlılığı, mobil bulgular, sahte/statik içerik riski ve kalan P0 maddeleri `CRM_FILTER_AND_PRODUCT_AUDIT_2026-08-16.md` içinde kayıt altındadır. Özellikle rapor scope ayrımı ve sessiz sorgu limitleri çözülmeden şirket geneli rapor açılımı yapılmamalıdır.
