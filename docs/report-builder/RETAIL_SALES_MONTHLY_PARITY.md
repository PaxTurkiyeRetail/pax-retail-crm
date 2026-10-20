# Retail HTML / canlı 2026 satış ve aylık gerçekleşen eşitliği

CRM tablosunun kapsam ve sütun tipleri için [CRM havuzu alan mutabakatı](RETAIL_CRM_POOL_PARITY.md) belgesine bakın.

2026-10-19 tarihinde üretim DB üzerinde READ ONLY sorgularla doğrulandı. Kaynak veri değiştirilmedi. Diğer sekmelerin Forecast/KasaPOS/kiralama mutabakatı ayrı incelemededir.

## Özet

- Referans HTML mevcut durum: 23 firma, 1.432 terminal, 678 S210 aksesuar, 404.636 USD. Canlı: aynı firma ve adetler; 326.257,46 USD.
- Altı model × on iki ay = 72 hücre karşılaştırıldı. Tüm adetler aynı; yalnız Haziran A80, S210 ve A6630 ciro hücreleri farklı. Eksik veya fazladan canlı satış modeli/ayı yok.
- Aynı üç firma/dört import tutarı hem firma tablosu hem model finans tablosu hem Haziran aylık sonucunu açıklar. Bağımsız bir aylık hesaplama veya tarih filtresi hatası bulunmadı.

## Model finans tablosu

| Model | HTML adet | Canlı adet | HTML USD | Canlı USD | Fark USD |
|---|---:|---:|---:|---:|---:|
| A80 | 1183 | 1183 | 232.445,00 | 181.750,74 | 50.694,26 |
| A6650 | 221 | 221 | 111.220,00 | 111.220,00 | 0,00 |
| S210 | 678 | 678 | 51.338,00 | 29.722,64 | 21.615,36 |
| A920PRO | 11 | 11 | 3.224,00 | 3.224,00 | 0,00 |
| A6630 | 15 | 15 | 6.075,00 | 6,08 | 6.068,92 |
| A910S | 2 | 2 | 334,00 | 334,00 | 0,00 |

Ortalama fiyat = model USD / model adet. Yuvarlama yalnız gösterimde uygulanır; HTML tam dolara, canlı ekran iki ondalığa kadar gösterebilir. Veri onarımı öncesinde A80/S210/A6630 ortalamaları da doğal olarak farklıdır. LEE COOPER A80 anlaşma toplamı korunduğundan birim fiyatlar topluca yeniden hesaplanmamalıdır.

## Aylık gerçekleşen (terminal adedinde S210 hariç, USD tutarında dahil)

| Ay | HTML terminal | Canlı terminal | HTML USD | Canlı USD | Fark USD |
|---|---:|---:|---:|---:|---:|
| 1 | 503 | 503 | 94.061,00 | 94.061,00 | 0,00 |
| 2 | 66 | 66 | 23.105,00 | 23.105,00 | 0,00 |
| 3 | 13 | 13 | 2.431,00 | 2.431,00 | 0,00 |
| 4 | 315 | 315 | 122.349,00 | 122.349,00 | 0,00 |
| 5 | 2 | 2 | 721,00 | 721,00 | 0,00 |
| 6 | 322 | 322 | 91.145,00 | 12.766,46 | 78.378,54 |
| 7 | 137 | 137 | 38.886,00 | 38.886,00 | 0,00 |
| 8 | 53 | 53 | 24.662,00 | 24.662,00 | 0,00 |
| 9 | 21 | 21 | 7.276,00 | 7.276,00 | 0,00 |
| 10 | 0 | 0 | 0,00 | 0,00 | 0,00 |
| 11 | 0 | 0 | 0,00 | 0,00 | 0,00 |
| 12 | 0 | 0 | 0,00 | 0,00 | 0,00 |

## Fark sınıflandırması ve kapsam

**Kaynak veri:** 028 import migration + canlı staging dört tutarı yanlış saklıyor; referans HTML bu binlik ayırıcı hatalarının düzeltildiğini açıkça belgeliyor (satır 75). 030 migration staging tutarlarını kalem ve satış başlıklarına taşımış. Önerilen dört tutar ve onarım ön koşulları [gelir mutabakatı](RETAIL_REVENUE_RECONCILIATION.md) belgesindedir.

**Hesaplama tanımı:** Satış kalem toplamı ile anlaşma tutarı girilen başlık farklı olabilir. M&S - GAP başlık 225 USD, kalem 2.184 USD; mevcut Retail HTML ve canlı Retail kalem toplamını kullanıyor. Genel CRM ciro tanımı başlık toplamıdır. Üç firma onarılsa bile başlık bazlı toplam 402.677 USD olur; 404.636 USD kalem toplamıyla fark 1.959 USD kalır. Bu override ayrıca kaynak belgeye göre değerlendirilmelidir.

**Tarih / canlı değişiklik:** İncelenen 2026 satışlarının adet, firma, model ve ay dağılımı referansla aynı. Canlı tarafta yeni veya eksik 2026 aktif satıştan doğan fark bulunmadı. Yıl filtresi [2026-01-01, 2027-01-01); sadece aktif satış; tümü USD ve Retail; tamamı kalemli direct satış. İptal SUWEN 57.600 USD hariçtir. Aktif quote_id mükerrerliği yoktur. Havuz/satıcı adı bu raporun satış sorgusunda filtre değildir.

**Satır kapsamı:** fetchSales yalnız crm_sale_item_is_device sonucunu alan kalemleri okur; mevcut veride bu kalemler tüm 2026 satış kalemlerini kapsar. S210 peripheral/accessory tanımıyla bu sorguya dahildir; isTerminal S210 modelini terminal toplamından çıkarır. Cirodan kiralama kalemleri çıkarılır; mevcut aktif 2026 satışlarında kiralama yoktur. Gelecekte service/license kalemi eklenirse tüm satış başlığı cirosuyla eşitlik varsayılmamalıdır.

**Model/ay hücre kuralı:** HTML FC_ACTUAL sabit model×ay qty/USD; canlı fetchSales sale_date ayı bazında bağımsız satış kalemlerini toplar. Mevcut veriyle 72 adet hücresinin hepsi eşittir. 2026 sonuç sekmesindeki sarı Aralık planı gerçekleşen satışın parçası değildir; gerçekleşen 1.432 terminal sabittir. Satış ile planı birleştiren senaryo toplamı bu incelemede satış cirosu olarak değerlendirilmedi.

Kanıt: `.theme-audit/retail-review/sales-monthly-parity.json` (72 hücre), `revenue-firm-reconciliation.json` (23 firma), `revenue-live.json` (DB özetleri). Kod: `lib/reports/retail-operasyon.ts`, `lib/reports/retail-projection.ts`, `app/(panel)/crm/reports/retail-operasyon/RetailOperasyonClient.tsx`, `RetailResults.tsx`.
