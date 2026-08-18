# PAX CRM Kurumsal Hazır Oluş ve İyileştirme Raporu

**Tarih:** 16 Ağustos 2026  
**Kapsam:** Kod tabanı, uygulama mimarisi, kimlik/yetki, veri erişimi, güvenlik, operasyon, web/mobil UI ve kalite süreçleri  
**Çalışma biçimi:** Salt-okunur inceleme; ürün kodunda değişiklik yapılmadı.

> Bu rapor yalnızca depoda görülebilen yapıyı değerlendirir. Reverse proxy, firewall, PostgreSQL rolü, sunucu sertleştirmesi, canlı veri hacmi ve organizasyon politikaları ayrıca doğrulanmalıdır.

## 1. Yönetici özeti

Uygulama çalışan ve geniş bir iş kapsamını karşılayan bir CRM ürününe dönüşmüş durumda. TypeScript strict açık, production build başarılı, PostgreSQL sorgularının büyük kısmı parametreli, temel oturum güvenliği mevcut ve web arayüzünde responsive tasarım için kayda değer çalışma yapılmış.

Bununla birlikte mevcut yapı **kontrollü iç kullanım için işlevsel**, fakat daha geniş kurumsal yayılım ve Active Directory entegrasyonu öncesinde güvenlik ve sürdürülebilirlik açısından güçlendirilmelidir. En önemli konu, kimlik doğrulamadan çok **yetkilendirme modelidir**. Beş sabit rol var; fakat izinler işlem ve kayıt kapsamına ayrılmadığı için sıradan `user` rolü CRM ile raporları görebiliyor, CRM kaydı ve teklif güncelleme uçlarında sahiplik kontrolü bulunmuyor. AD bağlamak bu problemi çözmez; yalnızca kullanıcının kim olduğunu daha güvenilir biçimde söyler.

### Hazır oluş puanı

| Alan | Puan | Kısa değerlendirme |
|---|---:|---|
| İşlevsel kapsam | 4/5 | CRM, aktiviteler, teklifler, forecast, talepler ve raporlar geniş |
| Kimlik ve yetki | 2/5 | Merkezi kontroller var; gerçek RBAC/ABAC ve kayıt kapsamı yok |
| Uygulama güvenliği | 2/5 | Temel cookie/bcrypt iyi; rate limit, güvenlik başlıkları ve hata standardı eksik |
| Mimari sürdürülebilirlik | 2/5 | Modül klasörleri var; route, iş kuralı ve DB erişimi iç içe |
| Veri bütünlüğü | 2.5/5 | Bazı FK/CHECK/transaction yapıları iyi; kimlikler hâlâ metin alanlara bağlı |
| Test ve kalite | 1.5/5 | Build geçiyor; otomatik test yok, lint 109 uyarı |
| Operasyon/DevOps | 1.5/5 | PM2, health ve manuel backup var; CI/CD, rollback, migration standardı ve gözlemlenebilirlik yok |
| Web UI | 3.5/5 | Tasarım ve responsive altyapı güçlü; tutarlılık ve erişilebilirlik borcu var |
| Mobil hazır oluş | 2.5/5 | Responsive web var; yoğun tablolar mobilde yatay kaydırmaya dayanıyor, native/PWA paketi yok |

**Genel sonuç:** Kontrollü iyileştirme programı başlatılmadan kullanıcı ve modül sayısını agresif artırmak risklidir. Önce güvenlik tabanı ve rol modeli, sonra mimari parçalama yapılmalıdır; baştan mikroservise geçmek gerekli değildir.

## 2. Güçlü taraflar

- `strict: true` TypeScript kullanılıyor; typecheck ve production build başarıyla tamamlandı.
- Oturum cookie’si `httpOnly`, `sameSite: lax` ve yüksek öncelikle yazılıyor.
- Parolalar bcrypt ile doğrulanıyor; reset sırasında bcrypt cost 12 kullanılıyor.
- Şifre reset tokenı tek kullanımlı, süreli ve parola değişince kullanıcının oturumları kapatılıyor.
- SQL sorgularının büyük kısmı parametreli; özel query builder identifier alanlarını quote ediyor.
- Teklif yazma işlemleri için transaction yardımcıları bulunuyor.
- Merkezi `authz.ts` ve `roles.ts` dosyaları yetkilendirmeyi tek noktaya taşıma açısından iyi bir başlangıç.
- Health endpoint, PM2 yapılandırması ve admin backup ekranı operasyon düşüncesinin başladığını gösteriyor.
- Mobil menüde focus trap, Escape ile kapanma, `aria-expanded` ve odak iadesi uygulanmış.
- Mobil giriş ekranı 390×844 testinde yatay taşma üretmedi; input ve butonlar yaklaşık 50 px yüksekliğinde ve input fontu 16 px.
- Veri tabanında teklifler/talepler gibi bazı kritik alanlar için FK, unique ve CHECK constraint’leri mevcut.

## 3. Kritik bulgular

### P0-1 — Yetkilendirme gerçek bir RBAC/ABAC modeli değil

`canViewCRM` ve `canViewReports`, tanımlı beş rolün tamamına erişim veriyor. `canManageRequests` ise normalize edilebilen her role yönetim yetkisi veriyor. Böylece rol adı var, fakat işlevsel olarak önemli modüllerde roller yeterince ayrışmıyor.

Somut etkiler:

- CRM müşteri güncelleme uç noktası sadece “CRM görebilir” kontrolü yapıyor; kaydın sahibi, takım kapsamı veya `customer.update` izni kontrol edilmiyor.
- Teklif güncelleme ve durum değiştirme akışlarında teklif sahibi/takım kapsamı kontrolü yok.
- Talep modülünde tüm tanımlı roller atama ve öncelik değiştirebiliyor.
- Rapor erişimi tüm roller için açık; kişi, takım, hassas finansal veri ve export izinleri ayrılmamış.
- `crm_roles`, `crm_permissions`, `crm_role_permissions`, `crm_user_roles` ve override tabloları veritabanında bulunuyor; uygulama kodunda kullanılmıyor.

**Öneri:** Rol kontrolü yerine sunucu tarafında şu modeli kurun:

`permission = resource.action`, `scope = own | team | all`, opsiyonel alan maskesi ve export izni.

Örnek izinler: `customer.read`, `customer.update`, `customer.assign`, `quote.approve`, `report.sales.view`, `report.sales.export`, `request.assign`, `system.parameter.manage`, `backup.execute`.

### P0-2 — Kayıt sahipliği metin alanına bağlı; AD entegrasyonunu zorlaştırır

Müşteri sahibi uygulamada `sorumlu` adıyla metin olarak saklanıyor ve create/update uçları aktif kullanıcı veya sabit kullanıcı kimliği doğrulaması yapmadan bu metni kaydediyor. Veritabanında `musteriler.owner_user_id` alanı ve FK bulunmasına rağmen TypeScript uygulama kodunda kullanılmıyor. İsim değişikliği, aynı isimli kullanıcı, ayrılan çalışan ve AD e-posta değişikliği veri sahipliğini bozabilir.

**Öneri:** Sahiplik ve aktör alanlarını stable UUID/FK üzerinden yürütün. `sorumlu`, `created_by`, `reviewed_by` gibi metinleri yalnızca tarihsel görüntüleme snapshot’ı olarak tutun. AD/Entra tarafında e-posta yerine değişmeyen object ID/subject ile eşleyin.

### P0-3 — Kimlik uçlarında brute-force ve abuse koruması yok

Login, forgot-password, reset-password ve kullanıcı uygunluk kontrolünde rate limit, hesap kilitleme, IP/kullanıcı bazlı gecikme veya güvenlik olayı üretimi görünmüyor. Reset parolası için yalnızca 8 karakter alt sınırı var. `/api/auth/allow` aktif e-posta varlığını farklı cevaplarla açıklıyor ve kullanıcı enumerasyonuna imkân veriyor.

Ek riskler:

- Session ve reset tokenları veritabanında açık token olarak saklanıyor; veritabanı sızıntısında doğrudan kullanılabilir.
- Süresi dolmuş session/reset tokenları için planlı temizlik görünmüyor.
- Aynı kullanıcıya ait cihaz/oturum görüntüleme ve toplu iptal mekanizması yok.

**Öneri:** Tokenların yalnızca SHA-256 hash’ini saklayın; Redis veya DB tabanlı dağıtık rate limit kurun; auth başarısızlıklarını denetim olayına yazın; MFA/Conditional Access’i AD projesinin parçası yapın.

### P0-4 — Üretim bağımlılıklarında yüksek seviye açıklar var

16 Ağustos 2026 tarihli `npm audit --omit=dev` sonucu 4 yüksek seviye üretim bulgusu verdi: doğrudan Next.js 15.5.20 ve transitif `postcss`, `sharp`, `nanoid`. Audit, Next.js için semver-major olmayan 15.5.23 düzeltmesini öneriyor.

**Öneri:** Önce izole branch’te Next.js 15.5.23+ yükseltmesi, tam regression testi ve ardından canlıya kontrollü sürüm. CI’da her PR için dependency audit/SCA ve otomatik güncelleme politikası çalıştırın.

### P0-5 — Test ve CI kalite kapısı yok

Depoda unit, integration, E2E veya Playwright test paketi bulunmuyor; `.github/workflows` da yok. `verify` komutu build’i geçiriyor, ancak lint 109 uyarı üretiyor ve warning’ler deploy’u durdurmuyor. Özellikle eksik React hook dependency uyarıları stale veri veya beklenmeyen tekrar yükleme hatası doğurabilir.

**Öneri:** İlk kalite kapısı:

1. Permission matrix testleri.
2. Auth/login/reset/rate-limit integration testleri.
3. Müşteri, aktivite, teklif ve talep için PostgreSQL integration testleri.
4. Desktop 1440 px, tablet 768 px ve mobil 390 px E2E smoke testleri.
5. Migration boş DB ve production-benzeri snapshot testleri.
6. Lint warning bütçesini sıfıra indirme veya “yeni warning yok” kuralı.

### P0-6 — Backup var, kurumsal kurtarma sistemi yok

Admin uç noktası `pg_dump` ile yerel dosya oluşturuyor. Ancak retention, şifreleme, off-site kopya, otomatik zamanlama, backup bütünlük doğrulaması ve restore tatbikatı görünmüyor. Ayrıca tam `DATABASE_URL` komut satırı argümanı olarak child process’e veriliyor; işletim sistemi process listesinde credential görünme riski vardır. Yanıtta mutlak sunucu yolu ve pg_dump yolu da dönüyor.

**Öneri:** Backup’ı uygulama butonundan bağımsız altyapı işi yapın. Şifreli ve immutable off-site kopya, tanımlı RPO/RTO, günlük otomatik job, alarm ve en az aylık restore tatbikatı uygulayın. Credential’ı process argümanı yerine `.pgpass`/güvenli environment veya yönetilen backup sistemiyle verin.

## 4. Yüksek öncelikli mimari ve veri bulguları

### P1-1 — Route handler’lar fazla sorumluluk taşıyor

Birçok API dosyasında auth, body parse, doğrulama, iş kuralı, SQL/veri erişimi, response map ve hata çevirme aynı fonksiyonda. Örnekler:

- Aktivite create: 333 satır, cognitive complexity 65.
- Forecast blocker upsert: 163 satır, cognitive complexity 64.
- Forecast blocker list: 246 satır, cognitive complexity 58.
- Weekly activities report: 174 satır, cognitive complexity 58.
- Customer client component: 1.145 satır, cognitive complexity 59.
- Parameters client: 1.042 satır, cognitive complexity 46.

**Önerilen hedef:** Katmanlı fakat tek deploy edilen **modüler monolit**.

```text
app/api/*                          -> HTTP adapter: auth, input, response
modules/<module>/application      -> use-case / orchestration
modules/<module>/domain           -> iş kuralları, entity/value object
modules/<module>/infrastructure   -> PostgreSQL repository, external clients
shared/auth                       -> identity, permission, scope policy
shared/audit                      -> immutable audit events
shared/http                       -> error envelope, validation, correlation id
shared/db                         -> pool, transaction, migration contracts
```

Route handler ideal olarak 20–40 satır olmalı: validate → authorize → use case → map response.

### P1-2 — Tek DB credential ve “admin client” ayrımı yok

`createPgAdminClient()` yalnızca normal PostgreSQL client’ı döndürüyor; ayrı, kısıtlı bir kullanıcı veya güvenlik sınırı oluşturmuyor. Bütün route’lar aynı `DATABASE_URL` ile çalışıyor. Bu yapı, uygulama hatasında tüm tablo erişimini büyütür. RLS’nin etkili olup olmadığı connection rolünün tablo sahibi/BYPASSRLS durumuna bağlıdır ve ayrıca canlıda doğrulanmalıdır.

Baseline içinde eski Supabase döneminden kalan `anon` read/update policy’leri de var. Doğrudan DB/API erişimi bir gün açılırsa bunlar ciddi risk olabilir.

**Öneri:** Uygulama için least-privilege DB rolü, migration için ayrı DDL rolü, backup için ayrı rol. Canlıda grants/RLS audit çalıştırın ve eski `anon/authenticated` politikalarını temizleyin.

### P1-3 — Migration standardı yok; runtime DDL var

`db/` ve `sql/` altında tarih/sıra standardı tutarlı olmayan çok sayıda SQL dosyası var. Hangi migration’ın hangi ortamda uygulandığına dair tek bir migration history mekanizması görünmüyor. Uygulama runtime sırasında `create table`, `create index` ve `alter table` çalıştırıyor.

Riskler:

- Birden fazla instance aynı DDL’i çalıştırabilir.
- Request sırasında lock ve latency oluşabilir.
- Uygulama DB kullanıcısına gereksiz DDL yetkisi gerekir.
- Rollback ve ortam eşitliği kanıtlanamaz.

**Öneri:** Flyway, Liquibase, dbmate veya node-pg-migrate gibi tek araç seçin. Sıralı migration, checksum, CI dry-run, backup-before-migrate ve forward-fix/rollback politikası oluşturun. Runtime `ensure*Table/Column` fonksiyonlarını kaldırın.

### P1-4 — Transaction sınırları tutarsız

Teklif yazma servisinde transaction iyi uygulanmış. Buna karşılık müşteri account-change approval önce müşteriyi sonra talep kaydını ayrı işlemlerle güncelliyor; ikinci adım başarısız olursa müşteri değişmiş, talep pending kalabilir. Request update ile request event insert de atomik değil.

**Öneri:** Bir iş olayı birden fazla tabloyu değiştiriyorsa tek transaction ve gerektiğinde `SELECT ... FOR UPDATE`/optimistic version kullanın. Tekrarlı istekler için idempotency key ekleyin.

### P1-5 — Girdi ve hata sözleşmesi standardı yok

Request body’ler çoğunlukla `any`/manuel `String(...)` kontrolleriyle doğrulanıyor. Durum geçişleri, uzunluklar ve nested yapıların tamamı merkezi schema ile korunmuyor. Çok sayıda route DB/exception mesajını doğrudan kullanıcıya döndürüyor; bu hem bilgi sızıntısı hem de UI sözleşme kırılması riskidir.

**Öneri:** Zod/Valibot benzeri schema, ortak error code’ları ve standart envelope:

```json
{
  "error": {
    "code": "CUSTOMER_UPDATE_FORBIDDEN",
    "message": "Bu kayıt için güncelleme yetkiniz yok.",
    "correlationId": "..."
  }
}
```

Sunucu logu ayrıntılı, kullanıcı cevabı kontrollü olmalı.

### P1-6 — Denetim izi parçalı

Request event, forecast blocker history ve bazı `updated_by` alanları var; fakat müşteri, teklif, parametre, kullanıcı/rol, export, login ve backup işlemleri için tek, immutable audit standardı yok. Veritabanında `crm_audit_logs` bulunmasına rağmen uygulama kullanımına rastlanmadı.

**Öneri:** `actor_id`, `action`, `resource_type`, `resource_id`, `before`, `after`, `reason`, `correlation_id`, `ip_hash`, `created_at` alanlarıyla append-only audit. Hassas değerleri maskeleyin; audit tablosunu uygulama rolünün UPDATE/DELETE erişimine kapatın.

## 5. Active Directory entegrasyonu için doğru tasarım

AD entegrasyonunu “AD’deki role’ü al ve ekrana güven” şeklinde yapmayın. Kimlik ve iş yetkisini ayırın:

1. **Kimlik sağlayıcı:** Entra ID/OIDC veya on-prem AD FS/OIDC. Web uygulamasının doğrudan LDAP kullanıcı parolası toplaması önerilmez.
2. **Stable identity:** `external_provider`, `external_subject/object_id`, `user_id`, email ve display name ayrı tutulmalı.
3. **Group mapping:** AD grupları uygulama rollerine konfigürasyonla eşlenmeli; eşleşmeyen kullanıcı default-deny olmalı.
4. **İş kapsamı:** “Kendi müşteri portföyü”, “satış takımı”, “bölge” gibi kapsamlar AD’den değil CRM takım/sahiplik modelinden gelmeli.
5. **Provisioning:** JIT veya SCIM/scheduled sync; disabled/deleted AD kullanıcısı kısa sürede uygulamadan düşmeli.
6. **Session:** Grup/rol değişikliğinde session invalidation; kısa session, refresh politikası, Conditional Access/MFA.
7. **Break-glass:** Günlük kullanılmayan, güçlü korunan ve audit edilen en fazla 1–2 yerel acil admin hesabı.

### Önerilen rol matrisi

| Rol | Varsayılan kapsam | Ana izinler |
|---|---|---|
| Super Admin (break-glass) | all | Sistem kurtarma; günlük iş için kullanılmaz |
| CRM Business Admin | all | İş parametreleri, kullanıcı-role mapping, approval; DB backup ayrı izin |
| Sales Manager | team | Takım müşteri/teklif/forecast yönetimi, onay ve takım raporu |
| Account Manager | own (+ atanmış) | Kendi müşteri, aktivite, teklif ve forecast kayıtları |
| ITSM Agent/Manager | own/team | Talep kuyruğu, atama ve SLA; CRM satış verisi varsayılan kapalı |
| Reporter/Auditor | seçili raporlar | Read-only, export ayrıca verilir |
| Basic Employee | own | Talep oluşturma ve kendi taleplerini görme |
| Integration Service | endpoint bazlı | İnsan oturumu yok; yalnız gerekli API izinleri |

Rol adından daha önemlisi permission ve scope kombinasyonudur. UI menü gizleme yalnız kullanım kolaylığıdır; her izin API/use-case katmanında tekrar doğrulanmalıdır.

## 6. Web ve mobil UI/UX değerlendirmesi

### İyi olanlar

- PanelShell mobil sidebar, overlay, focus trap, Escape ve focus return açısından bilinçli yazılmış.
- 88 responsive media-query tanımı ve ortak `mobile-hardening.css` bulunuyor.
- Giriş ekranı 390 px genişlikte taşmıyor; kontroller dokunmaya uygun yükseklikte.
- Tema desteği ve görünür durumlar için tasarım tokenları var.
- Tabloların çoğu en azından `overflow-x: auto` ile ekranı kırmıyor.

### Geliştirilmesi gerekenler

1. **Mobilde tabloyu yalnız yatay kaydırmak yeterli değil.** Birçok ekran 850–1080 px min-width tablo kullanıyor. Mobilde öncelikli kolon + kart/list row + detay drawer tasarımına geçin. Yatay scroll yalnız ikincil/analitik görünüm olsun.
2. **Giriş formunda gerçek label yok.** Inputlar placeholder ile isimlenmiş; `id`, `name`, `<label>`/`aria-label` yok. Screen reader, password manager ve form analytics için düzeltin.
3. **Design system parçalı.** 2.039 satırlık `premium-ui.css`, 555 satırlık sidebar CSS, component içi style blokları ve genel selector’lar birlikte kullanılıyor. CSS Modules veya ortak bileşen kütüphanesiyle `Button`, `Field`, `Table`, `Modal`, `Drawer`, `EmptyState`, `Skeleton` standartlaştırılmalı.
4. **Dev component’ler çok büyük.** 1.145 satırlık müşteri ekranı ve 1.042 satırlık parametre ekranı test ve responsive bakımını zorlaştırıyor.
5. **Erişilebilirlik otomasyonu yok.** Klavye, focus-visible, contrast, reduced-motion, modal semantics ve WCAG 2.2 AA için axe tabanlı CI eklenmeli.
6. **Harici Google Fonts bağımlılığı var.** Kurumsal ağ, CSP, performans ve gizlilik için fontu self-host edin (`next/font/local` veya `next/font/google` build-time).
7. **Mobil uygulama paketi yok.** Depoda Capacitor config, Android/iOS projesi, web manifest veya service worker bulunmadı. Mevcut yapı responsive web’dir; native/PWA dağıtımı ayrıca ürün kararı ve build pipeline ister.

### Mobil ürün önerisi

- İlk aşamada responsive web/PWA’yı sağlamlaştırın: hızlı açılış, installable manifest, offline hata ekranı, push gereksinimi analizi.
- Ana mobil navigasyonu 4–5 çekirdek işe indirin: Genel Bakış, Müşteriler, Hızlı Aktivite, Talepler, Profil.
- Müşteri/aktivite/teklif formlarında sticky alt aksiyon barı, büyük touch target ve autosave/draft düşünün.
- Yönetim raporları ve büyük tablolar web-first kalabilir; mobilde özet KPI + drill-down sunun.
- Capacitor kullanılacaksa auth callback, secure storage, certificate policy, version enforcement ve mağaza release pipeline’ı ayrıca tasarlayın.

## 7. Operasyon ve gözlemlenebilirlik

Mevcut PM2 yapılandırması tek instance çalıştırıyor. Deploy script canlı dizinde `npm ci` + build + reload yapıyor; migration, smoke test, artifact promotion, otomatik rollback ve canary yok.

**Hedef yapı:**

- Her PR: typecheck, lint, unit/integration, permission matrix, migration test, SCA, secret scan.
- Main: immutable artifact/container oluşturma.
- Staging: migration + smoke + E2E + mobil viewport.
- Production: backup doğrulama → migration job → rolling/blue-green deploy → health/readiness → rollback.
- En az iki uygulama instance’ı; load balancer readiness kontrolü.
- Structured JSON log, correlation ID ve PII masking.
- Sentry/OpenTelemetry veya eşdeğer: error rate, p95/p99 latency, slow query, DB pool saturation, auth failure, job duration.
- Alarm: backup yaşı, restore test sonucu, 5xx oranı, login abuse, disk doluluğu, DB connection, certificate expiry.

Örnek başlangıç SLO’ları iş birimiyle netleştirilmelidir: aylık %99.9 erişilebilirlik, kritik API p95 < 500 ms, RPO ≤ 24 saat, RTO ≤ 4 saat.

## 8. Performans bulguları

Mevcut QA script’i 55 bulgu üretti. Özellikle `.limit(1500–5000)`, `select('*')` ve client-side filtreleme yaygın. CRM listesinde bazı filtreler 10.000 satıra kadar toplu çekim yapabiliyor. Rapor/PPTX üretim zincirlerinde transitive loop depth 5–6 seviyesine çıkıyor.

**Öneri:**

- Tüm listelerde DB-side filtre, cursor pagination ve dar kolon select.
- `EXPLAIN (ANALYZE, BUFFERS)` ile gerçek canlı veri hacminde indeks doğrulaması.
- Büyük PPTX/PDF/Jira raporlarını web request yerine background job/queue’ya taşıma.
- Rapor snapshot/cache ve kullanıcıya job status/download linki.
- DB pool için `max`, `statement_timeout`, `query_timeout`, `application_name` ve slow-query log politikası.
- Katalog/parametre gibi düşük değişen veriler için kontrollü cache; kullanıcıya özel CRM verisinde scope-aware cache key.

## 9. Öncelikli yol haritası

### 0–14 gün: Risk azaltma

- Next.js ve transitif güvenlik bulgularını kapatın.
- Login/reset/allow uçlarına dağıtık rate limit; `/auth/allow` enumerasyonunu kaldırın veya generic cevap verin.
- Production’da HTTPS + secure cookie zorunluluğunu doğrulayın; README’deki çelişkili `AUTH_COOKIE_SECURE=false` ifadesini düzeltin.
- CSP, HSTS, frame-ancestors, nosniff, referrer ve permissions başlıklarını reverse proxy/app’te standardize edin.
- Kritik write uçlarında geçici permission ve ownership kontrolü koyun.
- Backup credential aktarımını düzeltin; off-site şifreli backup ve restore tatbikatı başlatın.
- Lint hook uyarılarını ve raw DB error response’larını temizleyin.

### 2–6 hafta: Kurumsal güvenlik tabanı

- Permission + scope modeli ve rol matrisi.
- `owner_user_id`/actor FK geçişi ve veri backfill’i.
- Merkezi `authorize(permission, resource)` policy katmanı.
- Immutable audit log.
- Schema validation ve standart error envelope.
- Migration aracı; runtime DDL’nin kaldırılması.
- Auth, permission, CRUD ve migration integration testleri; CI gate.
- AD/Entra pilot tasarımı ve grup eşleme testi.

### 6–12 hafta: Mimari ve ürün kalitesi

- Customers, activities, quotes, forecast, requests modüllerini application/domain/repository katmanlarına ayırın.
- En büyük route ve component’leri use-case/bileşenlere bölün.
- Observability, SLO dashboard ve incident runbook.
- İki instance + rolling/blue-green deployment.
- Mobil tablo yerine mobil liste/kart dönüşümü; WCAG audit.
- PWA/Capacitor karar kaydı ve ayrı release pipeline.

### Sürekli

- Threat modeling, quarterly access review, dependency patch SLA.
- Yük testi ve kapasite planı.
- Veri saklama/silme politikası ve KVKK kapsamı.
- Aylık restore, üç aylık disaster-recovery tatbikatı.
- Architecture Decision Record (ADR) zorunluluğu.

## 10. “Done” kabul kriterleri

Kurumsal yayılımın bir sonraki dalgası için minimum kabul kriteri:

- Permission matrix API testleriyle kanıtlanmış; default-deny.
- Kayıt sahipliği UUID/FK bazlı; isim/e-posta bazlı yetki yok.
- Auth rate limit, güvenli token saklama, MFA/AD pilotu hazır.
- Bilinen kritik/yüksek production dependency açığı yok veya yazılı risk kabulü var.
- CI’da test/type/lint/migration/security kapıları yeşil; yeni warning kabul edilmiyor.
- Migration history, rollback/forward-fix ve backup/restore kanıtı var.
- Kritik işlemler immutable audit’e düşüyor.
- Desktop/tablet/mobile E2E smoke ve accessibility testi geçiyor.
- Health yanında readiness, structured logs, error/latency/backup alarmları var.
- Canlı deploy geri alınabilir ve en az iki instance üzerinde kesintisiz yapılabilir.

## 11. İnceleme kanıt özeti

- Bilgi grafiği: 297 dosya, 1.134 function, 74 API route dosyası, 37 SQL dosyası.
- `npm run verify`: typecheck ve production build başarılı; 109 lint warning.
- `npm audit --omit=dev`: 4 yüksek üretim bulgusu.
- `npm run qa:crm`: 55 bulgu; yüksek limitler ve `select('*')` ağırlıklı.
- Test/CI dosyası: bulunmadı.
- Mobil browser doğrulaması: 390×844 login ekranı, taşma yok; form label eksik.
- Native/PWA artifact: bulunmadı.

### Temel kaynak konumları

- Yetki kuralları: `lib/roles.ts`, `lib/authz.ts`
- Oturum/parola: `lib/auth.ts`, `lib/auth-cookie.ts`, `app/api/auth/*`
- Müşteri yazma: `app/api/crm/create/route.ts`, `app/api/crm/update/route.ts`
- Talep yazma: `app/api/requests/update/route.ts`
- Teklif yazma: `app/api/quotes/update/route.ts`, `lib/quotes/write-service.ts`
- DB erişimi: `lib/db.ts`, `lib/pg/admin.ts`, `lib/pg/client.ts`
- Runtime DDL: `lib/system-parameters.ts`, `app/api/admin/users/*`
- Backup: `app/api/admin/db-backup/route.ts`
- Deploy: `scripts/deploy-live.sh`, `ecosystem.config.cjs`
- UI shell/mobil: `components/PanelShell.tsx`, `styles/sidebar.css`, `styles/mobile-hardening.css`
- Büyük UI bileşenleri: `components/crm/CrmCustomersClient.tsx`, `app/(panel)/admin/parameters/ParametersClient.tsx`

