# Engel & Etki Modülü — Müşteri Bazlı Kurulum

## 1. Yetki ve kapsam

- `admin` ve `super_admin`: Tüm satış müşterilerini, ekip tamamlama raporunu ve aylık bütçe etkisini görür.
- Diğer CRM kullanıcıları: Yalnızca `musteriler.sorumlu` alanı kendi `allowed_users.full_name` değeriyle eşleşen müşterileri görür ve günceller.
- Yetki yalnız arayüzde değil; liste, kayıt, çözme, yeniden açma ve yönetim inceleme API'lerinde sunucu tarafında doğrulanır.
- İş ortağı / rapor-only müşteriler satış Engel & Etki kapsamına dahil edilmez.

## 2. Müşteri ve Forecast davranışı

- Ekran artık yalnız Forecast satırlarını değil, satışçının sorumluluğundaki **tüm müşterileri** listeler.
- Müşteri başına tek güncel Engel & Etki değerlendirmesi tutulur.
- Aktif Forecast bulunmayan müşteride de engel, çözüm sorumlusu ve çözüm tarihi girilebilir.
- Satışın başka aya/adede kayması seçilecekse müşteriye ait aktif Forecast seçmek zorunludur.
- Engel & Etki kaydı Forecast'ın ayını veya adedini otomatik değiştirmez.

## 3. SQL kurulumu / yükseltme

Önce veritabanı yedeği alın. Ardından proje klasöründe `.env.local` değişkenlerini yükleyip aynı SQL dosyasını çalıştırın:

```bash
cd ~/apps/pax-retail-crm
set -a
source .env.local
set +a

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f sql/forecast_blocker_impact_setup.sql
```

Dosya idempotenttir. Eski forecast-bazlı kurulum daha önce çalıştırılmışsa:

- `customer_id` alanını ekler ve mevcut kayıtlardan doldurur,
- müşteri başına en güncel değerlendirmeyi korur,
- Forecast bağlantısını opsiyonel hale getirir,
- view, index, constraint ve trigger'ları müşteri bazlı yapıya yükseltir.

Kontrol:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
select to_regclass('public.crm_forecast_blockers') as blockers_table;
select to_regclass('public.crm_forecast_blocker_history') as history_table;
select to_regclass('public.v_crm_forecast_blocker_impact') as impact_view;

select customer_id, musteri, sorumlu, active_forecast_count, effective_status
from public.v_crm_forecast_blocker_impact
order by musteri
limit 10;
SQL
```

## 4. Uygulama ekranı

- Menü: **Operasyon → Engel & Etki**
- Adres: `/crm/blocker-impact`
- Satışçı görünümü: Müşterilerim + üç soruluk giriş formu
- Yönetim görünümü:
  - Müşteri Listesi
  - Kullanıcı Tamamlama
  - Bütçe Etkisi
  - Üç sayfalı Excel yönetim raporu

## 5. Yayınlama

```bash
npm run check:build
npm run typecheck
npm run lint
npm run qa:crm
npm run build
pm2 restart all --update-env
pm2 status
```
