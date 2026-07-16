# CRM Premium Full v3.6 Notları

## Kapsam
Bu paket, CRM genelinde tek/iki ekran düzeltmesi yerine tüm mevcut paneli ortak premium kurumsal SaaS diline bağlayan geniş kapsamlı UI retrofit ve yetki düzeltmelerini içerir.

## Premium UI değişiklikleri
- Yeni global premium retrofit dosyası eklendi: `styles/premium-enterprise.css`.
- `PanelShell.tsx` içine `premium-enterprise.css` import edildi.
- Tüm CRM, Admin, Requests ve Rapor sayfalarında ortak görünüm kuralları uygulandı:
  - hero/header alanları,
  - kart/panel/surface yapıları,
  - tablo sarmalayıcıları,
  - input/select/textarea,
  - butonlar,
  - badge/chip/pill yapıları,
  - filtre ve aksiyon barları,
  - modal arka planları,
  - mobil kırılımlar.
- Sol menü daha geniş/premium hale getirildi ve Sistem/Talepler grupları eklendi.
- Route başlıkları genişletildi; teklif, aktivite, request, system tracker, sales radar, admin ekranları üst barda doğru bölüm/başlık gösterir.

## Admin / Super Admin yetki düzeltmeleri
- `requireSystemParametersAccessOrThrow` artık admin ve super_admin için doğrudan izin verir.
- Panel menüsünde admin/super_admin için Parametreler, Kullanıcılar ve DB Yedeği görünür.
- Forecast modülünde admin/super_admin tüm müşteri portföyünü görür.
- Standart kullanıcı kendi `sorumlu` olduğu müşterileri görmeye devam eder.
- Forecast kayıt oluşturma API'sinde admin/super_admin herhangi bir müşteriye forecast ekleyebilir.
- Admin bir müşteri adına forecast girerse forecast owner olarak müşterinin `sorumlu` alanı kullanılır; işlemi yapan kişi `created_by_name` alanında tutulur.

## Forecast özel düzeltme
- Önceki sorun: `/api/forecast/list` sadece `allowed_users.full_name = musteriler.sorumlu` eşleşmesiyle çalışıyordu. Bu yüzden admin kullanıcının adına atanmış müşteri yoksa ekran boş geliyordu.
- Yeni davranış: admin/super_admin için bu filtre kaldırıldı, tüm aktif portföy gelir.
- Forecast ekranındaki açıklama ve KPI dili admin kapsamını gösterecek şekilde güncellendi.
- Forecast raporu owner seçenekleri artık sadece forecast girilmiş kişilerden değil, `crm_forecasts`, `musteriler.sorumlu` ve `allowed_users.full_name` kaynaklarından birleşik gelir.

## Kontrol
- `npm run check:build` başarılı.
- `npm run build` derleme aşamasında `Compiled successfully` verdi; ortamda `Collecting page data` adımı uzun sürdüğü için komut süre sınırına takıldı.
- `npx tsc --noEmit` projedeki eski genel TypeScript hatalarını göstermeye devam ediyor. Yeni forecast/admin yetki/premium dosyalarında hata görünmedi.

## Canlıya alma
Forecast SQL daha önce çalışmadıysa önce:

```bash
psql "$DATABASE_URL" -f sql/forecast_module_setup.sql
```

Sonra normal deploy:

```bash
npm install
npm run check:build
npm run build
pm2 restart <crm-process-name>
```
