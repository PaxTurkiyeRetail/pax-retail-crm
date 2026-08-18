# CRM Temiz Baseline ve Satış Veri Kaynağı Analizi

Tarih: 2026-07-23
Kapsam: `crm_local` (localhost:5432), salt okunur analiz. Kod/DB değiştirilmedi.

## 1. Teknik doğrulama

- `.next` cache temizlendi, kaynak/SQL/backup dosyalarına dokunulmadı.
- `npm run typecheck` (temiz) → PASS
- `npm run lint` → 0 error, 109 warning (unused var / exhaustive-deps, hepsi ön-mevcut)
- `npm run build` → PASS
- `npm run typecheck` (build sonrası) → PASS

## 2. Native kalıntı kontrolü

`android/`, `ios/`, `native-web/`, `.gradle-native-cache*`, `capacitor.config.*` → yok.
`package.json` içinde `@capacitor/*`, `capacitor`, `cordova` referansı yok.

**NATIVE_CLEAN**

## 3. Mevcut DB envanteri (24 tablo, 7 view)

Tablolar: allowed_users, crm_forecast_blocker_history, crm_forecast_blockers, crm_forecasts,
faz_tanimlari, import_teknik_aktiviteler, is_ortagi_faz_tanimlari, musteri_account_change_requests,
musteri_kunye, musteri_kunye_v2, musteri_pipeline, musteriler, password_reset_tokens,
pipeline_eventleri, quote_items, quote_pricing_rules, quote_products, quotes, request_categories,
request_events, requests, system_parameters, teams, user_sessions.

Views: v_crm_forecast_blocker_impact, v_crm_forecast_report, v_musteri_kunye_form,
v_musteri_kunye_status, vw_crm_musteriler, vw_crm_report_accounts, vw_crm_timeline.

### Satışla ilgili tablo kolonları (satır sayısı ile)

- **quotes** (26 satır): id, customer_id, opportunity_title, proposal_date, valid_until,
  follow_up_date, owner_name, owner_email, owner_user_id, probability, **status**,
  **closed_reason**, total_device_count, total_amount, hardware_amount, monthly_amount,
  **closed_at**, quote_no, created_at, updated_at.
- **quote_items** (44 satır): quote_id→quotes, quantity, unit_price, total_price, product bilgisi.
- **requests** (3 satır): requester_id, assignee_id, team_id→teams, category_id, priority, sla_hours,
  sla_status, status, ai_intent, ai_confidence — destek/ticket alanları.
- **musteriler** (367 satır): id, musteri, satis_olasiligi, sorumlu, owner_user_id, sektor.
- **musteri_pipeline** (180 satır): musteri_id→musteriler, aktif_faz_no, aktif_iteration_no,
  durum (enum: Başlamadı/Devam Ediyor/Tamamlandı/İhtiyaç Duyulmadı), owner.
- **pipeline_eventleri** (807 satır): musteri_id, faz_no, event_type (enum: set_active,
  status_changed, quote_sent, owner_changed, ...), durum, created_by.
- **crm_forecasts** (0 satır): customer_id, product, forecast_year, forecast_month, quantity,
  probability — aylık tahmin kaydı.
- **crm_forecast_blockers / _history**: forecast'ı geciktiren engel takibi, workflow_status.
- **allowed_users** (9 satır): id (uuid), email, role, is_active,
  weekly_target_sales_physical/online/phone/email, weekly_target_technical_physical/online,
  weekly_target_total_activities, weekly_target_unique_customers.
- **faz_tanimlari** (25 satır): faz_no 1-25, asama_adi (ör. 15="Sipariş", 25="Verimlilik/Referans").
- **teams**: id, name, routing_rules — yalnız `requests.team_id` ile bağlı (destek yönlendirme).

## 4. "Gerçekleşen satış" kaynağı — KESİN BULUNDU

Kodda tanımlı: `lib/quotes/catalog.ts`
```
QUOTE_STATUSES = ['draft', 'sent', 'closed']
QUOTE_CLOSED_REASONS = ['won', 'lost', 'expired', 'no_interest']
```
Zaten üretimde kullanılan kural (`app/api/quotes/stats/route.ts:78`):
```
won_quotes = rows.filter(status === 'closed' && closed_reason === 'won')
```
Aynı mantık `app/api/reports/quotes/route.ts` içinde de var.

1. **Evet.** `quotes.status = 'closed' AND quotes.closed_reason = 'won'`.
2. Tablo/kolon: `quotes.status`, `quotes.closed_reason`.
3. Satış tarihi: `quotes.closed_at`.
4. Satış tutarı: `quotes.total_amount` (kırılım: `hardware_amount`, `monthly_amount`).
5. Cihaz adedi: `quotes.total_device_count` (veya `sum(quote_items.quantity)` çapraz doğrulama).
6. **Hayır, her onay değil** — yalnız `closed_reason='won'` olan `closed` teklif satış sayılır;
   `closed_reason='lost'/'expired'/'no_interest'` satış değildir.
7. `requests` sipariş/satış kaydı **değil** — SLA/priority/ai_intent alanlarıyla destek-ticket akışı.
8. **Hayır, tek başına güvenle anlaşılamaz.** `faz_tanimlari` faz 15 = "Sipariş" fazına geçiş olayı
   var (`pipeline_eventleri.event_type`de ayrı bir "sipariş" event'i yok), ama bu fazda tutar/tarih
   alanı tutulmuyor — sadece aşama takibi, finansal kayıt değil.
9. **Düşük risk, dikkat gerektirir:** Bir müşterinin birden çok teklifi olabilir (draft/sent/closed
   karışık). Sayım **quote id bazında** ve yalnız `status='closed' AND closed_reason='won'` filtresiyle
   yapılmalı; pipeline event'leri veya forecast kayıtlarıyla çakıştırılmamalı (farklı amaçlar).
10. İptal/kayıp: `closed_reason IN ('lost','expired','no_interest')` ile ayrılıyor.
   Mevcut veride 26 tekliften 1'i `closed/lost`, `won` durumunda henüz kayıt yok (0).

## 5. Teklif / Forecast / Pipeline / Request ayrımı

**Teklif (quotes):** Potansiyel tutar (`total_amount`, `probability`). `status='closed' AND
closed_reason='won'` olduğunda kesin satış sayılır. Status: draft, sent, closed.

**Forecast (crm_forecasts):** Aylık miktar tahmini (ürün bazlı), gerçekleşen satış **değil**.
Tarih: `forecast_year`+`forecast_month`. Değer: `quantity`, `probability`. Şu an 0 satır — kullanılmıyor.

**Pipeline (musteri_pipeline / pipeline_eventleri):** Müşteri fazı — satış fırsatının 25 aşamalı
süreç takibi (Lead→Referans). "Kazanıldı" adında ayrı bir faz yok; en yakını faz 15 "Sipariş" ve
faz 25 "Referans"tır ama bunlar finansal kapanış kaydı değil, süreç durumu.

**Request (requests):** Talep/destek ticket'ı (SLA, öncelik, AI sınıflandırma). Sipariş veya satış
kaydı değil, teknik/operasyonel iş akışı.

## 6. Kullanıcı ve ekip ilişkisi

1. Kullanıcı kimliği: `allowed_users.id` (uuid, PK). `quotes.owner_user_id`/`owner_email`,
   `musteriler.owner_user_id` bununla eşleşiyor.
2. Rol kaynağı: `allowed_users.role` (metin), `lib/roles.ts` üzerinden normalize ediliyor —
   sabit 5 rol: `super_admin, admin, account_manager, itsm, user`.
3. Ekip/müdür ilişkisi: **Yok.** `teams` tablosu yalnız `requests.team_id` ile destek yönlendirmede
   kullanılıyor; `allowed_users`e bağlı değil, müdür (manager_id) kolonu yok.
4. Satışçıya hedef bağlamak için güvenilir kullanıcı ID'si: **Var** — `allowed_users.id`.
5. Şirket/ekip/satışçı kapsamı: Satışçı seviyesi kurulabilir (allowed_users.id üzerinden).
   Ekip/şirket seviyesi **kurulamaz** (ilişki yok).
6. Ekip tablosu gerekecek mi: Yalnız ekip bazlı hedef/rollup isteniyorsa evet; bireysel hedef
   için gerekmiyor — zaten `allowed_users` içinde haftalık hedef kolonları mevcut
   (`weekly_target_sales_physical/online/phone/email`, `weekly_target_technical_*`,
   `weekly_target_total_activities`, `weekly_target_unique_customers`).

## 7. Minimal hedef sistemi önerisi (yalnız tasarım, SQL yok)

Önemli tespit: `allowed_users` zaten sabit haftalık hedef kolonları taşıyor. Bunlar "güncel/tekil"
değerler — zaman serisi (aylık/haftalık geçmiş) veya yeni metrik eklenebilirliği isteniyorsa aşağıdaki
2 tablo yeterli, fazlası gerekmiyor.

### crm_target_definitions
```
Amaç: Hedeflenebilir metrik kataloğu (ör. sales_physical, sales_won_amount, unique_customers).
Zorunlu kolonlar: id, metric_key (unique), label, unit
Bağlanacağı mevcut tablo: yok (bağımsız katalog)
Neden gerekli: yeni metrik eklerken şema değişikliği yerine satır eklemek için.
Neden daha az tabloyla yapılamıyor: metrik kataloğu ile değer tablosu ayrılmazsa her yeni
  metrik için yeni kolon açmak gerekir (mevcut allowed_users'ın yaşadığı sorun).
```

### crm_target_values
```
Amaç: Kullanıcı bazlı, dönem bazlı (hafta/ay) hedef ve gerçekleşen değer kaydı.
Zorunlu kolonlar: id, user_id→allowed_users.id, metric_key→crm_target_definitions.metric_key,
  period_start (date), target_value, actual_value (nullable, sonradan hesaplanır)
Bağlanacağı mevcut tablo: allowed_users
Neden gerekli: geçmiş dönem hedeflerini kaybetmeden saklamak (allowed_users yalnız "güncel" tutuyor).
Neden daha az tabloyla yapılamıyor: tek tablo hem katalog hem değer olsaydı metric_key tekrarlanır,
  yeni metrik eklemek satır+etiket tutarlılığını bozar.
```

**crm_sales_teams / crm_sales_team_members önerilmiyor** — şu an ekip bazlı hedef/rollup talebi yok,
`allowed_users`de manager/team ilişkisi de yok. Yalnız ileride ekip rollup'u istenirse gündeme gelir.

Role/permission/revision/snapshot/audit/TV-device tabloları **önerilmiyor** — bir önceki Codex
setinin tekrarı olur, mevcut `allowed_users.role` + sabit 5 rol yeterli.

## 8. Web tabanlı TV yaklaşımı

1. `allowed_users.role`'e `tv_viewer` eklenebilir — ama bu bir kod değişikliği
   (`lib/roles.ts`daki `AllowedRole` birleşimine yeni literal eklemek) gerektirir; DB şeması
   değişmez, yalnız uygulama kodu.
2. Evet — yeni permission tablosu olmadan, `lib/roles.ts` içindeki `can*` fonksiyonlarına
   `tv_viewer` için salt-okunur/dashboard-only kural eklemek yeterli.
3. Evet — `tv_viewer` rolüne PII (musteriler/quotes detay) route'ları kapatılıp yalnız
   dashboard/aggregate route'lara izin verilerek sağlanabilir.
4. Mevcut `user_sessions` / auth session süresi genel kullanım için yeterli; TV özelinde daha
   uzun oturum istenirse bu bir ürün kararıdır, DB şeması gerektirmez.
5. **Hayır**, ayrı `crm_tv_devices` tablosuna ihtiyaç yok — cihaz kimliği yerine rol tabanlı,
   normal web login + salt-okunur route yeterli.

**Tercih onaylandı: TV cihaz tablosu yok, native uygulama yok, web tabanlı read-only ekran
(`/tv/dashboard`), `tv_viewer` rolü ile.**

## Ana karar

**READY_FOR_MINIMAL_TARGET_SCHEMA**

Gerekçe: Gerçekleşen satışın kaynağı (`quotes.status='closed' AND closed_reason='won'`), tarihi
(`closed_at`), tutarı (`total_amount`), kullanıcı bağlantısı (`owner_user_id`→`allowed_users.id`)
kod ve DB'de zaten kesin ve üretimde kullanılan bir kuralla tanımlı. Ek ürün kararı gerekmiyor.
