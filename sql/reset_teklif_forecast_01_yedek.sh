#!/usr/bin/env bash
# ============================================================================
# TEKLİF + FORECAST + ENGEL & ETKİ SIFIRLAMA — 1) YEDEK (silmeden önce, tahabitim olarak)
#   a) tam pg_dump (custom format)   → backups/prereset-<zaman>.dump
#   b) silinecek tabloların CSV'si   → backups/reset-YYYYMMDD/*.csv (Excel'de açılır)
# Kullanım (proje kökünden): cd ~/apps/pax-retail-crm && bash sql/reset_teklif_forecast_01_yedek.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."   # proje kökü (yedek + node scripts oradan çalışır)
DB="${DATABASE_URL:-$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-)}"
# predeploy-backup.mjs ortam değişkeni okur (npm script'i --env-file ile yüklüyor);
# doğrudan çağırdığımız için DATABASE_URL'i açıkça geçiyoruz.
export DATABASE_URL="$DB"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/reset-${STAMP}"
mkdir -p "$OUT"

echo "[1/2] pg_dump → backups/prereset-${STAMP}.dump"
node --env-file-if-exists=.env.local scripts/predeploy-backup.mjs --prefix prereset --keep 10

echo "[2/2] CSV dışa aktarım → ${OUT}/"
psql "$DB" -v ON_ERROR_STOP=1 \
  -c "\copy (select * from public.quotes order by quote_year, quote_serial) to '${OUT}/quotes.csv' csv header" \
  -c "\copy (select qi.*, q.quote_no from public.quote_items qi join public.quotes q on q.id = qi.quote_id order by q.quote_year, q.quote_serial, qi.line_no) to '${OUT}/quote_items.csv' csv header" \
  -c "\copy (select pe.*, m.musteri from public.pipeline_eventleri pe left join public.musteriler m on m.id = pe.musteri_id where pe.event_type = 'quote_sent' order by pe.created_at) to '${OUT}/pipeline_eventleri_quote_sent_oncesi.csv' csv header" \
  -c "\copy (select f.*, m.musteri from public.crm_forecasts f left join public.musteriler m on m.id = f.customer_id order by f.forecast_year, f.forecast_month, m.musteri) to '${OUT}/crm_forecasts.csv' csv header" \
  -c "\copy (select b.*, m.musteri from public.crm_forecast_blockers b left join public.musteriler m on m.id = b.customer_id order by b.created_at) to '${OUT}/crm_forecast_blockers.csv' csv header" \
  -c "\copy (select h.*, m.musteri from public.crm_forecast_blocker_history h left join public.musteriler m on m.id = h.customer_id order by h.changed_at) to '${OUT}/crm_forecast_blocker_history.csv' csv header"

ls -la "$OUT"
echo "Yedek tamam. Şimdi: psql \"\$DB\" -v ON_ERROR_STOP=1 -f sql/reset_teklif_forecast_02_sil.sql"
