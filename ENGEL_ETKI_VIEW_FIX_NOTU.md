# Engel & Etki View Migration Fix

Eski Forecast bazlı `v_crm_forecast_blocker_impact` view'ı ile yeni müşteri bazlı view'ın kolon sırası farklıdır.
PostgreSQL bu değişikliği `CREATE OR REPLACE VIEW` ile kabul etmez.

Kalıcı kurulum dosyası düzeltildi:

- `sql/forecast_blocker_impact_setup.sql`

Dosya artık view bölümünü transaction içinde güvenli biçimde kaldırıp yeniden oluşturur.
Tablo verileri ve geçmiş kayıtları silinmez.

Acil tek seferlik dosya:

- `sql/forecast_blocker_impact_view_hotfix.sql`
