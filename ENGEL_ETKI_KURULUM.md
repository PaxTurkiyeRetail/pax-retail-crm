# Engel & Etki Modülü

Bu paket, eski çalışan CRM yapısına yalnızca Engel & Etki modülünü ekler.
Müşteriler, dashboard, aktiviteler, teklifler, mevcut Forecast akışı ve ortak DB katmanı değiştirilmemiştir.

## Tek SQL dosyası

Yalnızca şu dosya kullanılmalıdır:

```text
sql/forecast_blocker_impact_setup.sql
```

Eski deneme/hotfix dosyaları kullanılmamalıdır. Sunucuda varsa şu eski dosyalar silinebilir:

```text
sql/forecast_blocker_impact_view_hotfix.sql
sql/2026-07-20_forecast_blocker_history_nullable_forecast.sql
```

## Kurulum

Önce mevcut Forecast SQL yapısının kurulu olduğundan emin olun:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/forecast_module_setup.sql
```

Ardından tek Engel & Etki SQL dosyasını çalıştırın:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/forecast_blocker_impact_setup.sql
```

## Yetki davranışı

- `admin` ve `super_admin`: tüm müşterileri, kullanıcı tamamlama raporunu ve bütçe etkisini görür.
- Diğer CRM kullanıcıları: yalnız `musteriler.sorumlu` alanı kendi adlarıyla eşleşen müşterileri görür ve yalnız bu müşterilere kayıt girebilir.
- Yetki kontrolü yalnız arayüzde değil, API tarafında da uygulanır.

## Veritabanı nesneleri

- `public.crm_forecast_blockers`
- `public.crm_forecast_blocker_history`
- `public.v_crm_forecast_blocker_impact`

`crm_forecast_blocker_history.forecast_id` nullable tutulur. Böylece aktif Forecast'ı olmayan bir müşteriye "Engel yok" kaydı girilebilir.
