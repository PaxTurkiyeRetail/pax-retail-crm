# CRM Premium Full V3.7 - Forecast UI / Menu / SQL / Export

## Yapilanlar

### 1) Forecast giris ekrani
- Musteri tablosundan `Durum` sutunu kaldirildi.
- `Eksik/Girildi` yazili pill artik gosterilmiyor.
- Forecast olmayan satirlar kirmizi tonla, forecast olan satirlar yesil tonla anlasilir hale getirildi.
- Ilk hucrede ince renk seridi birakildi; tablo daha sade gorunur.

### 2) Sol menu sadeleştirme
- Sol menuden `Sistem` grubu kaldirildi.
- Sol menuden `Talepler` grubu kaldirildi.
- Parametreler / Kullanici Yonetimi / DB Yedegi sag ust kullanici menusu altinda kaldi.
- `/requests` sayfalari panel icinde aktif bir menu aksiyonu olmaktan cikarildi; direkt gidilirse CRM ana ekrana yonlenir.

### 3) Forecast raporu export
- Forecast Raporu ekranina `Excel / CSV Indir` butonu eklendi.
- Indirilen dosya UTF-8 BOM ile uretilir; Turkce karakterler Excel'de bozulmaz.
- CSV kolonlari: Musteri, Sektor, Account, Urun Kodu, Urun Adi, Donem, Satis Kanali, Gerceklesme Orani, Adet, Agirlikli Adet, Not.
- Mevcut filtreler ekranda hangi satirlari getiriyorsa indirilen CSV de ayni satirlari verir.

### 4) SQL tek dosya senkronizasyonu
- `sql/forecast_module_setup.sql` tek idempotent kurulum/senkronizasyon dosyasi haline getirildi.
- Eksik tablo/kolon/index/view/trigger/parametre varsa ekler.
- Bilinen eski forecast tarih/period kolonlarini temizler.
- Parametreleri tekrar tekrar duplicate etmez; varsa label/value/sira bilgilerini gunceller.
- Forecast donemi tarih olarak degil `forecast_year + forecast_month` olarak tutulmaya devam eder.

## Canliya alma

```bash
psql "$DATABASE_URL" -f sql/forecast_module_setup.sql
npm install
npm run check:build
npm run build
pm2 restart <crm-process-name>
```

## Kontrol

- `npm run check:build` basarili.
- `npx tsc --noEmit` projedeki eski genel TypeScript hatalarini gostermeye devam ediyor; bu paketle degisen forecast/menu/export dosyalarinda yeni hata gorunmedi.
