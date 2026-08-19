# Final AD/RBAC Production Readiness Audit — 2026-08-19 (Rev. 2)

Kapsam: AD-only login + AD Group → CRM Role → RBAC mimarisi. Yeni özellik yok, sadece doğrulama + NO-GO düzeltme paketi.

## Revizyon Geçmişi

- **Rev. 1 (CONDITIONAL GO)**: statik kod PASS, 3 canlı doğrulama (checksum/orphan/Entra E2E) bekliyordu.
- **Bağımsız statik audit → NO-GO**: kullanıcı, çalışma dizininin tam snapshot'ını (tar.gz) bağımsız denetledi, 9 gerçek kod defekti buldu (Graph `sub`/`oid` karışıklığı, `allowed_users.role` authorization sızıntısı, tek-rol union eksikliği, screen-guard boşlukları, last-super-admin bypass/TOCTOU, duplicate OIDC seed satırları, `/api/auth/allow` sızıntısı, imkansız checksum tavsiyesi, eksik orphan sorgu kapsamı). NO-GO ilan edildi.
- **Rev. 2 (bu doküman)**: 9 defektin tamamı düzeltildi. Karar **CONDITIONAL GO**'ya geri döner — statik taraf tekrar PASS, aynı 3 canlı doğrulama gate'i hâlâ zorunlu.

## Özet Karar

**CONDITIONAL GO**

Kod/statik taraf tam PASS (9/9 NO-GO maddesi kapatıldı, typecheck temiz). Blocker'lar yine sadece canlı DB/Entra erişimi gerektiren adımlar. Aşağıdaki manuel adımlar tamamlanmadan prod deploy yapılmasın.

---

## 0. NO-GO Düzeltme Paketi — 9/9 Kapatıldı

| # | Defekt | Düzeltme |
|---|---|---|
| 1 | Graph `/users/{id}/memberOf` çağrısı OIDC `sub` (pairwise) ile yapılıyordu, `oid` (immutable Object ID) değil | `lib/auth/oidc.ts`, `effective-permissions/route.ts`: `oid` claim kullanılıyor; `auth_identities.object_id` kalıcı saklanıyor |
| 2 | `lib/authz.ts` authorization'ı `allowed_users.role`'den türetiyordu (AD Groups → RBAC zinciri bypass) | AD session'lar için `user_sessions.effective_roles` snapshot'ından hesaplama; `allowed_users.role` sadece legacy session compatibility fallback |
| 3 | Multi-group union yok, tek "bestRole" tutuluyordu | `resolveEnterpriseUser` tüm eşleşen rolleri (`roles[]`) döner, `permissionsForRoleSet`/`effective-permissions` tüm rollerin RBAC permission union'ını hesaplar |
| 4 | Menüde gizli ama URL ile erişilebilen sayfalar (screen guard eksik) | `/crm`, `/crm/activities`, `/crm/[musteriId]`, `/admin/parameters`, `/admin/db-backup`, `/requests`, `/requests/[id]`, `/crm/quotes/catalog`, `/crm/activities/new`, `/crm/reports/*` (9 alt sayfa) → hepsine `requireScreenAccessOrThrow` eklendi. Sunucu bileşeni olmayan 2 route (`activities`, `[musteriId]`) server wrapper + `*Client.tsx` ayrımıyla yeniden yapılandırıldı. Redirect-only alias route'lara dokunulmadı |
| 5 | POST `ON CONFLICT DO UPDATE` son aktif super_admin mapping'i sessizce indirebiliyordu + PATCH/DELETE arası TOCTOU | POST/PATCH/DELETE üçü de aynı transaction'da `pg_advisory_xact_lock` ile serialize edilir, POST artık aynı invariant kontrolünü paylaşır |
| 6 | `system_oidc_enabled`/`system_oidc_group_role_sync_enabled` için duplicate seed satırı, `order by sort_order, label` tie-break yanlış (güvensiz) satırı seçiyordu | Duplicate satırlar SQL kaynağından kaldırıldı, group_key başına tek kanonik satır |
| 7 | `/api/auth/allow` 202 dönüp local login kullanılabilir izlenimi veriyordu | 410 `LOCAL_AUTH_DISABLED` (diğer local-auth endpoint'leriyle tutarlı) |
| 8 | Önceki checksum tavsiyesi ("migration'ı tekrar çalıştır, checksum otomatik güncellenir") `scripts/migrate.mjs` davranışıyla çelişiyordu (mismatch'te dosyayı hiç çalıştırmadan throw ediyor) | Aşağıda §1 — gerçek diff-tabanlı, kör-overwrite'sız prosedür |
| 9 | Orphan sorgu listesi eksikti (`requests.ai_suggested_assignee` dahil) | Aşağıda §2 — dinamik FK+soft-reference envanteri |

---

## 1. Migration / SQL Gate — MANUAL REQUIRED

Otorite dosya: `db/migrations/20260818_004_consolidated_schema_baseline.sql`

Bu segmentte dosya 3 kez düzeltildi (madde 1/2/3/6 SQL değişiklikleri: `auth_identities.object_id`, `user_sessions.effective_roles` kolonları + duplicate OIDC seed temizliği). Önceki checksum (`4045b251f412...`) artık **geçersiz**. Güncel lokal checksum:

```
aaa47e320f4738bbe4445c04704a434d93d6bd03bdab5b6dd3d479333c0e613c
```
(sha256, UTF-8, `db/migrations/20260818_004_consolidated_schema_baseline.sql`)

**Canlıda çalıştırılacak sorgu:**
```sql
select version, checksum, applied_at
from public.crm_schema_migrations
where version = '20260818_004_consolidated_schema_baseline.sql';
```

**Karar ağacı (kör overwrite YOK):**
- **Satır yok** → migration hiç uygulanmamış (muhtemel senaryo, önceki CONDITIONAL GO'dan bu yana canlıya hiçbir şey deploy edilmediyse). `npm run db:migrate` çalıştır — dosya tamamen `IF NOT EXISTS`/idempotent guard'lı, güvenli.
- **Satır var, checksum yukarıdakiyle eşleşiyor** → PASS, dosya deploy edilenle aynı.
- **Satır var, checksum eşleşmiyor** → asla elle `update ... set checksum = ...` yapma. Önce gerçek fark tespiti:
  1. Canlı şemayı çıkar: `pg_dump --schema-only --no-owner --no-privileges -n public > live_schema.sql`
  2. Repo'daki migration dosyasını boş bir local/staging DB'ye uygula, aynı şekilde `pg_dump --schema-only` al: `expected_schema.sql`
  3. `diff live_schema.sql expected_schema.sql` — semantik fark yoksa (yalnız yorum/whitespace/sıralama farkı) checksum'ı DB'de bu commit'in checksum'ına güncellemek güvenlidir çünkü şema zaten hedefle birebir. Fark **varsa** (canlı şema repo'dan geride/farklı) elle checksum güncelleme **yasak** — önce `information_schema.columns`/`pg_constraint` bazında hangi `alter table` bloklarının eksik olduğunu satır satır çıkar, DBA ile onaylat, gerekirse migration dosyasının eksik kalan parçasını canlıda manuel/`psql` ile idempotent guard'larıyla uygula, sonra checksum'ı güncelle.
  4. Hiçbir adımda `DROP`/`TRUNCATE`/`DELETE` çalıştırma; fark kapatma her zaman additive olmalı.

## 2. Veri Bütünlüğü (FK + Soft-Reference Orphan) — MANUAL REQUIRED

### 2a. Gerçek FK kolonları (DB constraint koruyor, orphan teorik olarak imkânsız — doğrulama amaçlı)
```sql
select 'crm_target_values.scope_user_id' c, count(*) from public.crm_target_values t left join public.allowed_users u on u.id=t.scope_user_id where t.scope_user_id is not null and u.id is null
union all select 'crm_target_values.created_by', count(*) from public.crm_target_values t left join public.allowed_users u on u.id=t.created_by where t.created_by is not null and u.id is null
union all select 'crm_target_values.updated_by', count(*) from public.crm_target_values t left join public.allowed_users u on u.id=t.updated_by where t.updated_by is not null and u.id is null
union all select 'auth_identities.user_id', count(*) from public.auth_identities t left join public.allowed_users u on u.id=t.user_id where u.id is null
union all select 'musteriler.owner_user_id', count(*) from public.musteriler t left join public.allowed_users u on u.id=t.owner_user_id where t.owner_user_id is not null and u.id is null
union all select 'password_reset_tokens.user_id', count(*) from public.password_reset_tokens t left join public.allowed_users u on u.id=t.user_id where u.id is null
union all select 'pipeline_eventleri.created_by_user_id', count(*) from public.pipeline_eventleri t left join public.allowed_users u on u.id=t.created_by_user_id where t.created_by_user_id is not null and u.id is null
union all select 'pipeline_eventleri.updated_by_user_id', count(*) from public.pipeline_eventleri t left join public.allowed_users u on u.id=t.updated_by_user_id where t.updated_by_user_id is not null and u.id is null
union all select 'user_sessions.user_id', count(*) from public.user_sessions t left join public.allowed_users u on u.id=t.user_id where u.id is null;
```
0 dışı sonuç → şema bozulmuş demektir, acil incele (Postgres bunu zaten engellediği için pratikte olmamalı).

### 2b. Dinamik soft-reference envanteri (FK YOK — repo/kod bilgisi olmadan canlıda kendini güncel tutar)

Önceki liste eldeydi ve `requests.ai_suggested_assignee` gibi kolonları kaçırdı. Bunun yerine **her seferinde canlıda çalıştırılacak** keşif sorgusu — `allowed_users.id` (uuid) ile isim örtüşmesi olan ama gerçek FK constraint'i olmayan tüm uuid kolonlarını bulur:

```sql
-- 1) Aday kolonları bul (uuid tipinde, isim deseni user/actor/owner/assignee/requester/manager/created_by/updated_by/changed_by içeren, allowed_users hariç)
select c.table_name, c.column_name
from information_schema.columns c
where c.table_schema = 'public'
  and c.data_type = 'uuid'
  and c.table_name <> 'allowed_users'
  and (
    c.column_name ~* '(user_id|actor_id|owner|assignee|requester|manager_id|created_by$|updated_by$|changed_by)'
  )
  and not exists (
    -- zaten gerçek FK ile korunanları ele
    select 1
    from information_schema.key_column_usage kcu
    join information_schema.table_constraints tc
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and kcu.table_name = c.table_name
      and kcu.column_name = c.column_name
      and ccu.table_name = 'allowed_users'
  )
order by 1, 2;
```

Bu sorgunun döndürdüğü her `(table_name, column_name)` çifti için otomatik orphan-count SQL'i üretmek üzere:

```sql
select format(
  'select %L as c, count(*) from public.%I t left join public.allowed_users u on u.id = t.%I where t.%I is not null and u.id is null'
  , table_name || '.' || column_name, table_name, column_name, column_name
)
from (
  -- yukarıdaki keşif sorgusunun sonucu
) as candidates;
```
çıktısındaki her satırı `union all` ile birleştirip tek seferde çalıştır. Bilinen güncel adaylar (bu segment itibarıyla, canlıda teyit edilmeli): `requests.requester_id`, `requests.assignee_id`, `requests.ai_suggested_assignee`, `request_events.actor_id`. Sonuç > 0 olan satır varsa **hiçbir kaydı silme/güncelleme**, sadece rapor et, iş birimine sor.

## 3. RBAC Bütünlüğü — PASS (statik doğrulandı)

- Permission catalog + role-permission seed: `INSERT...SELECT ... WHERE NOT EXISTS (... role_key='X')` guard'ı — rol daha önce configure edilmişse seed tekrar ezmez.
- `super_admin`: hem legacy hem AD-session yolunda kod seviyesinde `ALL_PERMISSIONS` override — DB satırları silinse bile tam yetkili kalır (`lib/authz.ts` `permissionsForRoleSet` + legacy branch).
- `admin.identity.manage`, `screen.admin.identity.view`: seed'de yalnız `super_admin` dizisinde.
- `group-mappings` POST/PATCH/DELETE: üçü de `pg_advisory_xact_lock` ile serialize, aynı `assertActiveSuperAdminCountAbove` invariant'ını paylaşıyor — last-super-admin bypass ve TOCTOU kapatıldı.
- AD session authorization: `effective_roles` snapshot üzerinden, `allowed_users.role`'e dokunmuyor. Legacy session compatibility fallback açıkça yorumla işaretli.
- Screen guard coverage: 39 page route'un tamamı tarandı, eksik olan ~15 route'a `requireScreenAccessOrThrow` eklendi (bkz. §0 madde 4).

## 4. Entra Test Matrisi

| Senaryo | Sonuç |
|---|---|
| App Role claim authz kaynağı değil (sadece audit metadata) | PASS (kod) |
| Group sync disabled → 503 `OIDC_GROUP_SYNC_DISABLED` | PASS (kod) |
| Eşleşmeyen grup → 403 `OIDC_NO_GROUP_ROLE` | PASS (kod) |
| Disabled user → 403 `OIDC_USER_DISABLED` | PASS (kod) |
| Graph çağrısı `oid` (immutable) kullanıyor, `sub` değil | PASS (kod, bu segmentte düzeltildi) |
| Multi-group → union edilmiş rol/permission seti | PASS (kod, bu segmentte düzeltildi) |
| Mapped group ile başarılı login | MANUAL/STAGING REQUIRED |
| Unmapped group reddi (uçtan uca) | MANUAL/STAGING REQUIRED |
| Grup kaldırma sonrası rol kaybı (sonraki auth'ta) | MANUAL/STAGING REQUIRED |
| Mapped super_admin login (break-glass) | MANUAL/STAGING REQUIRED |
| Sadece App Role, grup mapping yok → erişim yok | MANUAL/STAGING REQUIRED |
| Graph/identity service erişilemezliği → local fallback YOK | MANUAL/STAGING REQUIRED |
| `is_active=false` → oturum anında kesilir | MANUAL/STAGING REQUIRED |

## 5. Session Cutover — PASS

- `createSession(userId, authSource, effectiveRoles?)` — tek çağıran `app/auth/callback/route.ts` → `'active_directory'` + `user.roles` (multi-group union) snapshot'ı.
- `is_active` her istekte kontrol ediliyor → legacy session + `is_active=false` = anında red.
- Legacy session + `is_active=true` → TTL sonuna kadar çalışır (`effective_roles` null, `allowed_users.role` compatibility fallback), sonra AD zorunlu.

## 6. Local Auth Regresyon — PASS

- `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/allow` → hepsi 410 + `LOCAL_AUTH_DISABLED` (madde 7, bu segmentte tamamlandı).
- `allowed_users.role` AD session'lar için authorization kaynağı değil.

## Typecheck / Build

- `npx tsc --noEmit` → temiz (bu segmentteki tüm 9 madde + screen-guard sweep sonrası tekrar doğrulandı).
- `npm run build` → henüz bu segmentte tekrar çalıştırılmadı, deploy öncesi tekrar koşulmalı.

## Kritik Blocker Listesi (deploy öncesi kapatılmalı)

1. §1 — checksum canlı DB karşılaştırması + (gerekirse) diff-tabanlı reconciliation yapılmadı.
2. §2 — dinamik + statik orphan sorguları canlıda çalıştırılmadı.
3. §4 — Entra uçtan uca test senaryoları (9 adet) staging'de koşulmadı, sonuçlar kanıt olarak saklanmadı.
4. Break-glass kontrolü: en az bir gerçek AD grubunun `super_admin`'e map edildiği ve o grubun bir test kullanıcısının gerçekten Entra üzerinden authenticate olduğu doğrulanmadı.

## Rollback Planı

- Kod: önceki deploy'a geri dön — DB tarafında veri kaybı riski yok (migration additive, `password_hash` drop edilmedi).
- DB: migration idempotent/additive, rollback migration gerekmez. Sorun migration içeriğindeyse forward-fix tercih edilir, DROP/DELETE ile geri alınmaz.
- Session: rollback sonrası legacy login tekrar aktif olur, mevcut `active_directory` session'lar etkilenmez.
