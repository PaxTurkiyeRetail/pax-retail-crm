#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [[ ! -f .env.local ]]; then
  echo "HATA: $APP_DIR/.env.local bulunamadi. .env.local.example dosyasini kopyalayip doldurun." >&2
  exit 1
fi

command -v node >/dev/null || { echo "HATA: node bulunamadi" >&2; exit 1; }
command -v npm >/dev/null || { echo "HATA: npm bulunamadi" >&2; exit 1; }

# Çalışan build'e dokunma: yeni build diğer slotta hazırlanır.
ACTIVE_BUILD=".next"
if [[ -f .next-active ]]; then ACTIVE_BUILD="$(cat .next-active)"; fi
case "$ACTIVE_BUILD" in .next|.next-a|.next-b) ;; *) echo "Gecersiz aktif build" >&2; exit 1 ;; esac
if [[ "$ACTIVE_BUILD" == ".next-a" ]]; then export NEXT_DIST_DIR=".next-b"; else export NEXT_DIST_DIR=".next-a"; fi
echo "Build slot: $ACTIVE_BUILD -> $NEXT_DIST_DIR"

npm ci
npm run verify

# Açık sekmelerin eski hash'li CSS/JS dosyaları da yeni sunucudan okunabilsin.
if [[ -d "$ACTIVE_BUILD/static" ]]; then
  mkdir -p "$NEXT_DIST_DIR/static"
  cp -an "$ACTIVE_BUILD/static/." "$NEXT_DIST_DIR/static/"
fi
npm run db:preflight

# Build başarılı olmadan canlı DB'ye dokunma. Migration öncesi geri dönüş için
# PostgreSQL custom-format yedeği zorunludur.
npm run db:backup:predeploy
npm run db:migrate

if command -v pm2 >/dev/null; then
  if pm2 describe pax-retail-crm >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --only pax-retail-crm --update-env
  else
    pm2 start ecosystem.config.cjs --only pax-retail-crm
  fi
  pm2 save
  pm2 status

  HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT:-5043}/api/health}"
  for attempt in 1 2 3 4 5; do
    if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null && node scripts/verify-static-assets.mjs; then
      echo "Canli saglik kontrolu basarili: $HEALTH_URL"
      printf '%s\n' "$NEXT_DIST_DIR" > .next-active.tmp
      mv .next-active.tmp .next-active
      exit 0
    fi
    sleep 2
  done
  echo "HATA: Deploy sonrasi saglik kontrolu basarisiz: $HEALTH_URL" >&2
  echo "Onceki build'e donuluyor: $ACTIVE_BUILD" >&2
  export NEXT_DIST_DIR="$ACTIVE_BUILD"
  pm2 reload ecosystem.config.cjs --only pax-retail-crm --update-env
  pm2 save
  exit 1
else
  echo "Build tamamlandi. PM2 kurulu degil: sudo npm install -g pm2"
fi
