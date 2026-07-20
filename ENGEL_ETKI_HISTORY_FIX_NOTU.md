# Engel ve Etki History Düzeltmesi

## Kök neden
Müşteri bazlı yapıda `forecast_id` boş olabilir. Eski kurulumdan kalan
`crm_forecast_blocker_history.forecast_id NOT NULL` kısıtı, Forecast'ı olmayan
müşteriler için history trigger kaydını engelliyordu.

## Kalıcı düzeltme
- Ana kurulum SQL'i legacy kolonda `NOT NULL` kısıtını kaldırır.
- Ayrı idempotent hotfix SQL'i eklendi:
  `sql/2026-07-20_forecast_blocker_history_nullable_forecast.sql`
- API artık ham PostgreSQL hata metnini kullanıcıya göstermez.
- Engel ve Etki isteklerinde çift hata bildirimi kaldırıldı.

## Canlı uygulama
```bash
set -a
source .env.local
set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f sql/2026-07-20_forecast_blocker_history_nullable_forecast.sql
pm2 restart pax-retail-crm --update-env
```
