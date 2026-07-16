# CRM Premium Full V3.15 Notes

## Forecast raporu export güncellemesi
- Forecast CSV/Excel exportunun en altına iki ayrı özet bloğu eklendi.
- Blok 1: `Ay Bazında Model ve Adet`
  - Tarih + Model bazında girilen toplam adetleri toplar.
- Blok 2: `Gerçekleşme Oranına Göre Ay Bazında Model ve Adet`
  - Tarih + Model bazında adedi gerçekleşme oranı ile çarpar.
  - Örnek: 100 adet ve %30 gerçekleşme oranı = 30 adet.
- Tarih değerleri yine `Aralık 2026` gibi text olarak korunur; Excel'in `Ara26` formatına çevirmesi engellenir.

## Kontrol
- `npm run check:build` başarılı geçti.
