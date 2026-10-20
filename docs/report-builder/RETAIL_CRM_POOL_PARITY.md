# Retail HTML / canlı CRM havuzu alan mutabakatı

2026-10-19 üretim DB read-only sorguları ve referans HTML gömülü JSON'u karşılaştırıldı. Kişi adları çıktıya taşınmadı; Account eşitliği hash üzerinden kontrol edildi. Veri değiştirilmedi.

| Gösterge | HTML tablo kaynağı | Canlı kaynak |
|---|---:|---:|
| Tekil firma | 530 | 551 |
| POS markası bilinen | 84 | 124 |
| Kasa firması bilinen | 156 | 196 |
| Kasa adedi bilinen | 83 | 125 |
| Bilinmeyen kasa firması | 374 | 355 |
| Univera | 65 | 65 |
| Inhouse | 44 | 12 (+ ayrı İnhouse: 3) |
| Nebim | 29 | 54 |
| Toshiba | 18 | 25 |

**Referansın kendi tutarsızlığı:** `D.crm` 530 satırdır; isim tekilleştirmesi sayıyı değiştirmez. Hepsijet tekrarının gizlendiği açıklaması ve `D.kcounts`/`D.pcounts` dağılımları eski toplam 531'i yansıtır: grafik Bilinmeyen kasa 375, tablodan hesaplanan 374; grafik Bilinmeyen POS 447, tablo 446. Bilinen POS yine 84'tür. 156 değeri kasa **firması** bilinen sayısıdır; kasa **adedi** bilinen sayısı 83'tür. Referansın eski grafiğini DB'ye yazmak doğru değildir.

## Kapsam farkı: projeksiyon dışı havuz / tüm Retail

HTML bölüm başlığı **Projeksiyon dışı CRM havuzu**; canlı `fetchCrmPool` yalnız `m.is_kolu='Retail'` filtresiyle tüm Retail müşterilerini alır. Satış/projeksiyon firmalarını dışlamaz.

- İki kaynakta ortak 480 firma vardır.
- Referanstaki diğer 50 firmanın tamamı, adları birebir eşleşen canlı **Vertical** kayıtlarıdır. Bunlar silinmemiştir; canlı Retail filtresinin dışında kalır. Örnekler: AKTİVE OTOMAT, ANTTECH, ATA ÜNİ., AVOLTA, WAT MOBİLİTE (KOÇ).
- Canlıdaki diğer 71 firma referansın CRM havuzunda yoktur. Bunların 42'si HTML'nin satış/projeksiyon/KasaPOS listelerinde normalize firma adıyla zaten bulunur. Kalan 29 için yeni kayıt/alias/kapsam ayrımı ayrıca değerlendirilmeli; otomatik birleştirme yapılmadı.
- Canlı ham sorgu 551 satır, 551 tekil müşteri UUID'si döndürür. `musteri_kunye_v2.musteri_id`, `musteri_pipeline.musteri_id`, `faz_tanimlari.faz_no` için mükerrer join anahtarı yoktur. Sayı farkı join fanout'u değildir; `report_only` nedeniyle dışlanan kayıt da yoktur.

## Ortak 480 firmanın sütunları

| Sütun | Sonuç |
|---|---|
| Firma / sektör | Eşit |
| Kasa adedi | Eşit |
| POS markası / POS sahipliği / bankalar | Eşit |
| Account | Eşit; kişi adları belgede gösterilmez |
| Kasa firması | 34 farklı değer |
| CRM statüsü | 480 kaydın tamamında farklı tanım |

Kasa firması farkı ağırlıkla referansın `Inhouse` altında topladığı gerçek sağlayıcıları canlıda ayrı göstermesidir. Örnekler: ALPET PETROL Inhouse → Enpos; ALTUN MARKET Inhouse → Smartpos; ANPA GROSS Inhouse → Posback; ANTEPLİOĞLU Inhouse → Barsoft. Mevcut sağlayıcı adlarını `Inhouse` ile ezmek veri kaybıdır. Referansla aynı görünüm isteniyorsa **ham sağlayıcı** ve **raporlama grubu** ayrı sütunlar olmalıdır.

Statü farkı basit canlı güncelleme olarak açıklanamaz: HTML `Lead`, `Hunter`, `Kasa` gibi portföy statülerini; canlı `ft.asama_adi` üzerinden `Lead Oluşumu`, `Ziyaret Planlama`, `Donanım Sunumu`, `Teklif Hazırlama + PAYLAŞIM`, `Faz yok` gibi ayrıntılı pipeline aşamalarını gösterir. Aynı başlık altında farklı kaynak tipleri kullanılıyor. Eşitlik için hangi statü tipinin gösterileceği belirlenmeli; müşteri fazları HTML kategorileriyle değiştirilmemelidir.

## Plan sütunları ve kayıt akışı

HTML model/adet/ay (2027) hücreleri `CRM_PLANS` ve gömülü/yerel tarayıcı planlarını kullanır. Canlı model/adet/ay sütunları kalıcı `planNext` Forecast kayıtlarını müşteri UUID'siyle eşler; `include_in_retail_plan=false` satırlarını dışlar. Bu iki plan deposu kendiliğinden aynı değildir. Canlı tablo ayrıca Bankalar ve Plan ekle işlemini içerir. Kaynak türünü koruyarak mutabakat yapılmalı; HTML planını mevcut Forecast satırlarının üstüne sessizce yazmak doğru değildir. Model/adet/ay plan tutarları Forecast incelemesinin kapsamındadır.

Önerilen eşitlik katmanları: (1) kapsam seçimi: tüm Retail veya referans projeksiyon dışı havuz, (2) ham kasa sağlayıcısını koruyan raporlama grubu, (3) portföy statüsü ile aktif pipeline fazını ayrı alanlar, (4) açıkça aktarılmış plan kayıtları. Sayıları 530/84/156'ya zorlamak bu tanım farklarını çözmez.

Kanıt: `.theme-audit/retail-review/crm-pool-live.json` (owner hash, kişi adı içermez), `crm-pool-parity.json` (alan farkları). Kod: `lib/reports/retail-operasyon.ts` `fetchCrmPool`; `app/(panel)/crm/reports/retail-operasyon/RetailOperasyonClient.tsx` CRM tablosu. Satış için [satış/aylık mutabakat](RETAIL_SALES_MONTHLY_PARITY.md), parasal onarım için [gelir mutabakatı](RETAIL_REVENUE_RECONCILIATION.md).
