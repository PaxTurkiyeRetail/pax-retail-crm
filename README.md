# PAX Retail CRM — Canli PostgreSQL Paketi

Bu paket doğrudan yerel PostgreSQL ile çalışır. Supabase URL/key değişkenleri ve Supabase SDK bağımlılıkları yoktur.

## Gereksinimler

- Node.js 22 LTS
- PostgreSQL 16+
- PM2
- Dolu bir `.env.local` dosyası

## Ortam dosyası

```bash
cp .env.local.example .env.local
nano .env.local
```

Zorunlu değer:

```env
DATABASE_URL=postgresql://postgres:URL_ENCODE_EDILMIS_SIFRE@localhost:5432/crm_local
AUTH_COOKIE_NAME=crm_session
AUTH_SESSION_TTL_HOURS=24
AUTH_COOKIE_SECURE=true
```

HTTPS kurulmadan geçici test yapılacaksa `AUTH_COOKIE_SECURE=false` kullanılabilir. Canlı HTTPS ortamında `true` olmalıdır.

## Kurulum ve build

```bash
npm ci
npm run check:build
npm run build
```

## PM2 ile çalıştırma

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` çıktısında verilen `sudo ...` komutunu bir kez çalıştırıp ardından tekrar `pm2 save` çalıştırın.

## Güncelleme

```bash
cd ~/apps/pax-retail-crm
git pull origin main
./scripts/deploy-live.sh
```

## Kontrol

```bash
curl -I http://localhost:3000/login
curl http://localhost:3000/api/health
pm2 logs pax-retail-crm --lines 100
```

Sağlık endpoint'i başarılıysa `ok: true` ve `database: connected` döner.

## Veritabanı

Mevcut dump zaten restore edilmişse tekrar SQL çalıştırmak gerekmez. Yeni kurulumda `db/` ve `sql/` klasörlerindeki dosyalar migration/başlangıç amaçlıdır.

## Güvenlik

- `.env.local` Git'e veya ZIP'e eklenmemelidir.
- Veritabanı portu internete açılmamalıdır; uygulama `localhost` üzerinden bağlanmalıdır.
- Canlı ortamda HTTPS ve `AUTH_COOKIE_SECURE=true` kullanılmalıdır.
