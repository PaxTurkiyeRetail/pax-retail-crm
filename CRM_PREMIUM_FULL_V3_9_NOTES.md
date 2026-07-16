# CRM Premium Full Forecast V3.9 Notları

## Bu revizyonda yapılanlar

### 1. Forecast ekleme akışı çoklu ürün satırına çevrildi
- Forecast giriş ekranında müşteri için tek tek modal açıp kapatma ihtiyacı kaldırıldı.
- Aynı müşteri üzerinde `+ Ürün Satırı Ekle` butonu ile birden fazla ürün satırı tek ekranda girilebilir hale getirildi.
- Her satırda ürün, adet, ay, yıl, satış kanalı, gerçekleşme oranı ve not alanı bağımsız çalışır.
- Tek `Satırları Kaydet` aksiyonu ile tüm satırlar API tarafında toplu kaydedilir.
- API geriye dönük uyumlu bırakıldı: eski tek ürün payload'ı da çalışır, yeni `items[]` payload'ı da çalışır.

### 2. Forecast create API toplu kayıt destekli hale getirildi
- Dosya: `app/api/forecast/create/route.ts`
- Tek istekte en fazla 50 forecast satırı kaydedilebilir.
- Admin/superadmin portföy yetki kuralı korunur.
- Normal kullanıcı sadece kendi portföyündeki müşteriye forecast girebilir.
- Ürün, adet, ay/yıl, kanal ve oran validasyonları satır bazlı yapılır.
- Kayıtlar transaction içinde işlenir; satırlardan biri hata alırsa tamamı rollback olur.

### 3. Forecast raporu indirme formatı düzeltildi
- İndirme kolonlarının başına `Tarih Text` kolonu eklendi.
- Dönem değeri Excel tarafından `Ara26` gibi tarihe çevrilmesin diye CSV içinde text olarak zorlandı.
- Örnek çıktı hücresi ekranda `Aralık 2026` olarak kalır.
- `Sektör` kolonu exporttan kaldırıldı.
- `Ağırlıklı Adet / Ağırlıklı Ortalama` exporttan kaldırıldı.
- Export sıralaması sadeleştirildi:
  1. Tarih Text
  2. Müşteri
  3. Account
  4. Ürün Kodu
  5. Ürün Adı
  6. Satış Kanalı
  7. Gerçekleşme Oranı
  8. Adet
  9. Not

### 4. Forecast raporu ekranı sadeleştirildi
- Ağırlıklı adet KPI kartı kaldırıldı.
- Detay tablosunda müşteri altında sektör satırı kaldırıldı.
- Detay tablosunda adet altında ağırlıklı adet satırı kaldırıldı.
- İndirme butonu `Forecast Raporunu İndir` olarak güncellendi.

### 5. Premium UI iyileştirmesi
- Çoklu ürün satırı formu kart/kırılım yapısına alındı.
- Her ürün satırı ayrı premium mini kart gibi gösterildi.
- Satır kaldırma ve satır ekleme aksiyonları netleştirildi.
- Mobil kırılımlar için çoklu ürün satırları responsive hale getirildi.

## SQL
Bu revizyonda yeni SQL değişikliği yoktur.
Forecast modülü daha önce kurulmadıysa tek dosya yeterlidir:

```bash
psql "$DATABASE_URL" -f sql/forecast_module_setup.sql
```

## Kontrol
- `npm run check:build` başarılı.
- `npx tsc --noEmit` projedeki eski genel TypeScript hatalarını göstermeye devam ediyor; yeni forecast dosyalarında hata görünmedi.
