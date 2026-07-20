# CRM Müşteri Veri Kaynağı Düzeltmesi

## Sorun

`musteriler` tablosunda kayıtlar bulunmasına rağmen Müşteriler, Genel Bakış,
Aktiviteler ve rapor ekranları yalnızca `vw_crm_musteriler` görünümünden
okuyordu. Görünüm faz/pipeline kaydı bulunmayan müşterileri döndürmediğinde bütün
CRM ekranları 0 kayıt gösteriyordu. Engel & Etki ekranı ana tablodan okuduğu için
aynı müşteriler orada görünmeye devam ediyordu.

## Kalıcı çözüm

`lib/pg/client.ts` içindeki okuma katmanı, `vw_crm_musteriler` isteyen bütün
mevcut ekranlar için müşteri ana tablosunu temel alan uyumlu bir okuma kaynağı
üretir:

- Her müşteri `public.musteriler` tablosundan alınır.
- Faz bilgisi `musteri_pipeline` üzerinden eklenir.
- Pipeline kaydı yoksa son aktivitenin fazı yedek olarak kullanılır.
- Faz adı `faz_tanimlari` üzerinden eklenir.
- Son not ve bekleyen taraf son aktiviteden tamamlanır.

Bu değişiklik Müşteriler, dashboard, aktivite müşteri seçimi ve mevcut raporları
tek noktadan düzeltir. Yeni SQL migration gerektirmez ve veri silmez.

## Canlı kontrol

```bash
cd ~/apps/pax-retail-crm
git pull origin main
npm install
npm run build
pm2 restart pax-retail-crm --update-env
```

Tarayıcıdan kontrol edilmesi gereken ekranlar:

- `/crm`
- `/crm/customers`
- `/crm/activities`
- `/crm/blocker-impact`
- `/crm/reports/phase-report`
- `/crm/reports/seller-summary`

Sunucu log kontrolü:

```bash
pm2 logs pax-retail-crm --lines 120 --nostream
```
