# Engel & Etki Modülü Kurulumu

## 1. SQL kurulumu

Uygulamayı yayınlamadan önce veritabanı yedeği alın ve aşağıdaki dosyayı çalıştırın:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/forecast_blocker_impact_setup.sql
```

Kontrol:

```sql
select to_regclass('public.crm_forecast_blockers');
select to_regclass('public.crm_forecast_blocker_history');
select to_regclass('public.v_crm_forecast_blocker_impact');
select * from public.v_crm_forecast_blocker_impact limit 5;
```

## 2. Uygulama ekranı

- Menü: **Operasyon → Engel & Etki**
- Adres: `/crm/blocker-impact`
- Normal kullanıcılar yalnızca kendi portföylerindeki aktif Forecast satırlarını görür.
- Admin ve Super Admin tüm projeleri, kullanıcı tamamlama durumunu ve aylık bütçe etkisini görür.

## 3. Veri davranışı

Engel ve Etki kaydı bir risk senaryosudur. Aşağıdaki Forecast alanlarını otomatik değiştirmez:

- `crm_forecasts.quantity`
- `crm_forecasts.forecast_year`
- `crm_forecasts.forecast_month`

## 4. Kontrol komutları

```bash
npm run check:build
npm run typecheck
npm run lint
npm run qa:crm
npm run build
```
