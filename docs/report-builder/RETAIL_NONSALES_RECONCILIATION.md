# Retail satış dışı alanlar: HTML / canlı kaynak mutabakatı

Tarih: 19.10.2026. Canlı okuma: 2026-10-19T14:04:41.159Z. Sunucu commit: `2cfa4fca59781aa4b84b063221ab8ac8bcdfbd17`.
Referans: `Retail_2026_2027.html`, kullanıcı masaüstündeki kopya. Tüm canlı sorgular `BEGIN READ ONLY`, `statement_timeout=20s`, `ROLLBACK` ile çalıştırıldı. Env içeriği okunmadı; kimlik bilgisi çıktılanmadı. Satış cirosu ayrı `RETAIL_REVENUE_RECONCILIATION.md` kapsamındadır.

## Sonuç

- KasaPOS 15 firmanın aktif / faturalanan / ek fırsat adetleri ve ana KPI değerleri eşit. Aylık tarihçede tek fark Ağustos gelirinde +183 USD. Firma oranlarının gösterim hassasiyeti farklı.
- Forecast, referansın 15 / 17 kayıtlık sürümü değildir. Departman süzgeci eksikliği gerçek kod hatasıdır; aşağıdaki dar düzeltme bunu giderir. Bunun ardından bile kayıtların yıl / model / adet / olasılık / iş modeli kaynakları aynı değildir.
- Tüm 269 aktif 2026/2027 forecast kaydı `sale`; tüm satış ve kira fiyat alanları boş. Referanstaki kiralama türlerini satış olarak kabul etmek veya sırf toplamı tutturmak için eski/yeni CRM kayıtlarını yeniden yazmak doğru değildir.
- HTML kiralama durumları aktif sözleşme kaynağıyla doğrulanamıyor. Canlıda aktif satışa bağlı kiralık cihaz satırı yok; sent teklif aktif kiralama değildir.

## KasaPOS: mevcut durum KPI ve firma tablosu

Canlı kaynak: aktif hizmet faturalarının KasaPOS / KasaPOS+TMS kalemleri; aktif kasa için künye net sayı öncelikli, yoksa müşteri kartı. Referans ay, yıl içindeki son fatura ayıdır: Ekim 2026. Gelir = USD fatura kalemlerinin toplamı; 101 firma-ay hücresinin tamamında kalem toplamları `adet × birim fiyat` ile eşleşti. Fatura para birimlerinin tamamı USD.

| Gösterge | HTML | Canlı | Fark |
|---|---:|---:|---:|
| Aktif kasa | 2.513 | 2.513 | 0 |
| Faturalanan kasa | 1.598 | 1.598 | 0 |
| Firma | 15 | 15 | 0 |
| Aylık hizmet geliri USD | 11.316 | 11.316 | 0 |
| Ek kasa fırsatı | 915 | 915 | 0 |
| Ek aylık gelir fırsatı USD | 7.526 | 7.526 | 0 |

Fırsat adedi = max(aktif − faturalanan, 0). Fırsat geliri = fark × firmanın son pozitif faturasından türetilen birim ücret. Markapark Ekim faturası yok; son geçerli ücret 8 USD ile 21 × 8 = 168 USD fırsat doğru biçimde korunuyor. Bunlar güncel stok / fatura görünümleridir; sonradan değişen künye geçmiş ay stokuna dönüştürülemez.

| Firma (canlı kanonik) | Aktif HTML/canlı | Faturalanan HTML/canlı | Fırsat HTML/canlı | Oran HTML / canlı (%) | Son ücret USD | Fırsat USD |
|---|---:|---:|---:|---:|---:|---:|
| BG STORE | 220 / 220 | 42 / 42 | 178 / 178 | 19.1 / 19 | 8 | 1.424 |
| ÇİFT GEYİK KARACA | 180 / 180 | 95 / 95 | 85 / 85 | 52.8 / 53 | 8 | 680 |
| EVKUR | 201 / 201 | 201 / 201 | 0 / 0 | 100 / 100 | 4 | 0 |
| FİBA RETAIL | 100 / 100 | 12 / 12 | 88 / 88 | 12 / 12 | 15 | 1.320 |
| İPEKYOL | 400 / 400 | 282 / 282 | 118 / 118 | 70.5 / 71 | 7 | 826 |
| JACK & JONES | 100 / 100 | 4 / 4 | 96 / 96 | 4 / 4 | 8 | 768 |
| KİĞILI | 400 / 400 | 302 / 302 | 98 / 98 | 75.5 / 76 | 6,5 | 637 |
| LEE COOPER | 40 / 40 | 25 / 25 | 15 / 15 | 62.5 / 63 | 8 | 120 |
| MAD PARFUM | 400 / 400 | 255 / 255 | 145 / 145 | 63.7 / 64 | 7 | 1.015 |
| MARKAPARK | 21 / 21 | 0 / 0 | 21 / 21 | 0 / 0 | 8 | 168 |
| NARAMAXX | 44 / 44 | 44 / 44 | 0 / 0 | 100 / 100 | 8 | 0 |
| SINIRLI SORUMLU | 1 / 1 | 1 / 1 | 0 / 0 | 100 / 100 | 8 | 0 |
| SUWEN | 220 / 220 | 220 / 220 | 0 / 0 | 100 / 100 | 7 | 0 |
| UNIFREE DUTY FREE | 66 / 66 | 66 / 66 | 0 / 0 | 100 / 100 | 15 | 0 |
| YARGICI | 120 / 120 | 49 / 49 | 71 / 71 | 40.8 / 41 | 8 | 568 |

HTML yüzdeleri çoğunlukla tek ondalık, canlı ortak hesap tam sayıya yuvarlıyor. MAD Parfüm HTML %63,7; 255/400 matematiksel %63,75, canlı %64. Ortak gösterim kuralı belirlenmeli; yüzdeyi referans sabiti olarak saklamak doğru olmaz.

### Aylık hizmet ve gelir

| Ay | Faturalanan HTML/canlı | HTML USD | Canlı USD | Fark USD |
|---|---:|---:|---:|---:|
| 2026-01 | 351 / 351 | 2.536 | 2.536 | 0 |
| 2026-02 | 351 / 351 | 2.536 | 2.536 | 0 |
| 2026-03 | 389 / 389 | 2.840 | 2.840 | 0 |
| 2026-04 | 389 / 389 | 2.840 | 2.840 | 0 |
| 2026-05 | 489 / 489 | 3.490 | 3.490 | 0 |
| 2026-06 | 730 / 730 | 5.129 | 5.129 | 0 |
| 2026-07 | 1.034 / 1.034 | 7.301 | 7.301 | 0 |
| 2026-08 | 1.249 / 1.249 | 8.838 | 9.021 | 183 |
| 2026-09 | 1.501 / 1.501 | 10.628 | 10.628 | 0 |
| 2026-10 | 1.598 / 1.598 | 11.316 | 11.316 | 0 |

Ağustos canlı MAD PARFUM: 183 × 8 USD = 1.464 USD. Aynı adet 7 USD ile hesaplanırsa 1.281 USD olur; aradaki 183 USD fark HTML aylık toplam farkını tam açıklar. **Bu aday açıklamadır:** HTML firma-ay fatura dökümü sunmadığı için HTML Ağustos MAD ücretinin 7 USD olduğunu kanıtlamaz. Canlı fatura kaynağı 8 USD içerir; belge onayı olmadan geçmiş faturayı değiştirmemek gerekir. Diğer aylar ve Ekim ana KPI eşittir. Ekim/Ocak büyüme oranı her iki tarafta 11.316/2.536 = 4,46 kat.

## Kiralama: referans durumları ve doğrulanmış kaynak

| Referans | Canlı kayıt | Mevcut gerçek durum | Eşitlik engeli |
|---|---|---|---|
| Tespo: aktif, SIM takip | Müşteri `2a6afbb8-cca3-49ac-ae9f-97042e2dc717`; teklif `bf1d543a-373d-4228-a5c7-16409fe2e27a` / Q-2026-001 | sent; A80 119 + A910S 49, birim kira 15 USD; başlangıç/bitiş boş; bağlı satış yok | Teklif 168 cihaz / 2.520 USD aylık potansiyel taşır; aktif sözleşme / tahsilat kanıtı değildir. |
| Ekol Giyim: aktif, SIM takip | Müşteri `c95612eb-a1b9-4666-a4a7-65f00e9f8793`; teklif `eb4e17ee-a18d-4086-aba0-00a09331ffab` / Q-2026-023 | draft; A910S 50, sale; kira fiyatı / tarih yok | Referans aktif kiralama türünü doğrulayacak satış/sözleşme kaydı yok. |
| BR Mağazacılık: imza bekliyor | TESPO/EKOL/BR MA/BR MAG ad araması BR müşteri veya teklif eşleşmesi üretmedi | Doğrulanmış kanonik müşteri eşlemesi yok | İsim benzerliğiyle başka firmaya bağlanmamalı. |

Canlıda kiralama kalemli 9 teklif var; tamamı sent, hiçbirinin bağlı satış kaydı yok. Aktif cihaz ve aylık kira KPI bu nedenle 0; bu sıfır tahsilatın dış dünyada olmadığını kanıtlamaz, CRM kanıtının eksikliğidir. `quotes/status` yalnız closed+won olduğunda aktif satış açar; `copySaleItemsFromQuote` kalemin tür/adet/aylık fiyat/tarihlerini kopyalar. Retail aktif özet `crm_sales.status=active` + cihaz kiralama kalemi + operasyon aktif + başlangıç gelmiş / bitiş geçmemiş koşulunu kullanır. Bekleyen teklifler ayrıca pipeline listesinde gösterilebilir; sözleşmeye dönüşmeden aktif cihaz veya gerçekleşen gelir toplamına eklenmemelidir. Kaynak farkını gizlemek için teklif durumu değiştirilmeyecek.

## Forecast: kapsam ve sürüm ayrımı

`fetchOpportunities` canlı committe departman filtresi olmadan tüm aktif forecast satırlarını alıyordu. Yerel dar düzeltme müşteri kartındaki kanonik `m.is_kolu = Retail` koşulunu ekler; hiçbir forecast yılı/adedi/türü/olasılığı/fiyatı değiştirilmez. Test özgün alanların aynen korunmasını ve SQL kapsamını doğrular. Bu düzeltme bu denetimde canlıya uygulanmadı.

| Yıl | HTML firma / cihaz | Canlı eski kapsam (non-S210) | Retail kapsamı sonrası (non-S210) | HTML satış / kira / banka | Canlı Retail kira |
|---|---:|---:|---:|---:|
| 2026 | 15 / 5.186 | 106 firma / 73.172 | 37 firma / 5.960 | 2.430 / 2.756 / 0 | 0 |
| 2027 | 17 / 6.595 | 122 firma / 25.423 | 97 firma / 18.338 | 1.250 / 4.845 / 500 | 0 |

Firma KPI raw plan satırlarından hesaplandığı için 2026 S210-only firma dahil 107 eski / 37 Retail firma; non-S210 altkümede eski 106. Satır sayıları aksesuar dahil 115+154=269; Retail kapsamı sonrası 42+129=171; cihaz matrisi S210 satırlarını çıkarır. 2026 yanlış kapsamda Vertical 19.712 ve Bank 47.500 cihaz ekliyordu; 2027 Vertical 7.085. Yalnız departmanı düzeltmek referansın plan sürümünü geri getirmez.

### Model adetleri: kaynaklar ayrı tutuldu

| Yıl / model | HTML | Canlı eski kapsam | Canlı Retail kapsam |
|---|---:|---:|---:|
| 2026 / A6630 | 0 | 15 | 15 |
| 2026 / A6650 | 2.750 | 2.458 | 2.456 |
| 2026 / A80 | 1.360 | 14.155 | 1.653 |
| 2026 / A910S | 0 | 48.822 | 1.052 |
| 2026 / A910SE | 996 | 0 | 0 |
| 2026 / A920PRO | 80 | 838 | 432 |
| 2026 / IM30 | 0 | 6.884 | 352 |
| 2027 / 8900 | 1.000 | 0 | 0 |
| 2027 / A35 | 2.100 | 0 | 0 |
| 2027 / A6650 | 1.350 | 2.610 | 2.610 |
| 2027 / A77 | 0 | 200 | 150 |
| 2027 / A80 | 1.215 | 6.401 | 6.401 |
| 2027 / A80+S210 | 0 | 5.855 | 5.855 |
| 2027 / A910S | 0 | 2.140 | 1.940 |
| 2027 / A910SE | 430 | 0 | 0 |
| 2027 / A920PRO | 350 | 3.242 | 232 |
| 2027 / ELYS-SET-2 | 0 | 50 | 50 |
| 2027 / IM30 | 150 | 4.925 | 1.100 |

### Referans satırları ve mevcut CRM adayları

Aşağıda yalnız noktalama / harf / Türkçe aksan normalizasyonuyla aynı firma eşlemesi kullanıldı. Karaca, Çift Geyik Karaca ile **birleştirilmedi**. Uzun ad / marka takma adı için insan onayı gerekir. S210 aksesuarları cihaz adedine dahil edilmedi. UUID olan adaylar güncellenecek kayıt talimatı değildir; kaydın yeni/manüel olup olmadığı ve rapor sürümü doğrulanmalı.

| HTML yıl / firma | HTML model; adet; iş modeli; olasılık | Aynı yıl canlı cihaz planı (ID ve özgün alanlar) | Yıl dışı aday (varsa) |
|---|---|---|---|
| 2026 / Beymen | A6650; 2.250; Satış; %90 | Eşleşme yok | — |
| 2026 / E-Bebek | A80; 1.300; Kiralama; %60 | Eşleşme yok | E-BEBEK: 2027-04 A80; 1.300; sale; %30; `c9b73484-8745-4184-baa3-c78083879e20` |
| 2026 / Damat Tween / D’S Damat | A910SE; 201; Kiralama; %90 | Eşleşme yok | DAMAT TWEEN  /  D'S DAMAT: 2027-01 A80; 200; sale; %60; `a18d4246-7335-4729-89aa-87b610296f58` |
| 2026 / Boyner | A6650; 200; Kiralama; %60 | BOYNER: 2026-11 A6650; 500; sale; %90; `b99b6a9f-1baf-46fd-b1ec-0cd45647c933` | — |
| 2026 / Skechers | A910SE; 200; Kiralama; %90 | Eşleşme yok | SKECHERS: 2027-06 A6650; 50; sale; %60; `c9a4bd4f-f3c6-4446-915b-6e301c7f2aac` |
| 2026 / Adil Işık | A910SE; 200; Kiralama; %60 | Eşleşme yok | ADİL IŞIK: 2027-01 A910S; 100; sale; %30; `3bb7a2ae-38d8-4420-9f7d-9c12031c3556` |
| 2026 / B&G Store | A910SE; 100; Kiralama; %90 | Eşleşme yok | BG STORE: 2027-06 A80; 50; sale; %60; `6e8fbc07-27a6-4ef5-bd56-a9fe2ebd3f2f` |
| 2026 / Schafer | A910SE; 100; Kiralama; %90 | Eşleşme yok | SCHAFER: 2027-06 A80; 140; sale; %30; `501a5cf7-22f9-4001-add5-337a5066861e` |
| 2026 / Ramsey | A6650; 100; Kiralama; %90 | Eşleşme yok | RAMSEY: 2027-01 A6650; 100; sale; %30; `d097d5e7-c882-49ae-b18f-9cf54be3554a` |
| 2026 / Greyder | A910SE; 100; Kiralama; %90 | Eşleşme yok | GREYDER: 2027-01 A920PRO; 50; sale; %60; `935edde6-a80d-45df-ac59-2cd305f703b7` |
| 2026 / Rebul | A6650; 100; Kiralama; %90 | Eşleşme yok | — |
| 2026 / Yves Rocher | A6650; 100; Satış; %30 | Eşleşme yok | YVES ROCHER: 2027-01 A6650; 100; sale; %30; `d0f11d0a-25f1-4bec-bbde-b4c6a985fe8a`<br>YVES ROCHER: 2027-01 A80; 500; sale; %30; `8c44fc6e-bc59-4b7e-9047-03beaed42666` |
| 2026 / Columbia | A910SE; 95; Kiralama; %90 | Eşleşme yok | COLUMBİA: 2027-06 A910S; 90; sale; %30; `54ec1883-a549-4415-8492-fb1f6f04509e` |
| 2026 / Fiba Retail | A920PRO; 80; Satış; %90 | Eşleşme yok | FİBA RETAIL: 2027-05 A920PRO; 82; sale; %30; `e767b1b7-ccf4-4c0f-acc4-2d02d018d317` |
| 2026 / Çiçek Retail Group | A80; 60; Kiralama; %90 | ÇİÇEK RETAIL GROUP: 2026-12 A80; 70; sale; %30; `2223446f-d18a-4487-b338-ea83df97c83c` | — |
| 2027 / Watsons | A35; 1.500; Kiralama; %60 | WATSONS: 2027-12 A80+S210; 1.250; sale; %30; `80be3db2-3625-405f-a5d8-30d77be21a1e`<br>WATSONS: 2027-12 A6650; 500; sale; %30; `1a8fe38a-edb8-4443-ab13-ad62a5d1bbe4` | — |
| 2027 / Yurtiçi Kargo | 8900; 1.000; Kiralama; %60 | Eşleşme yok | YURTİÇİ KARGO: 2026-12 A910S; 1.000; sale; %30; `435ee539-1b05-417f-a083-cc4927205a80` |
| 2027 / Toypa | A80; 650; Kiralama; %30 | TOYPA: 2027-03 A80; 590; sale; %30; `86721cb9-da1d-48f0-9a8e-59f387bccddf` | — |
| 2027 / Eti | A6650; 600; Satış; %30 | ETİ: 2027-12 A6650; 300; sale; %30; `8d239627-c5c9-4a41-b3b6-9d5886850ee8` | — |
| 2027 / Karaca | A35; 600; Kiralama; %30 | Eşleşme yok | — |
| 2027 / Ülker | A6650; 500; Satış; %30 | ÜLKER: 2027-08 A6650; 1.000; sale; %30; `54000f4a-49a0-4b87-a0be-95452f4f5ef6` | — |
| 2027 / Çetinkaya | A80; 500; Banka; %30 | ÇETİNKAYA: 2027-04 A80; 350; sale; %30; `bb209973-280c-4bee-bf01-92e2c53ab39b` | — |
| 2027 / Mudo | A920PRO; 350; Kiralama; %30 | MUDO: 2027-03 A910S; 5; sale; %30; `0840a31a-64ec-494a-9a37-4adce4e0cd60` | — |
| 2027 / Suvari | A6650; 200; Kiralama; %30 | SÜVARİ: 2027-01 A80; 200; sale; %30; `68877517-b81d-469e-9ca8-dc7ba6608925`<br>SÜVARİ: 2027-01 A6650; 50; sale; %60; `0ec27594-d893-4981-b804-6095e2557425` | — |
| 2027 / Galatasaray | A910SE; 200; Kiralama; %30 | Eşleşme yok | — |
| 2027 / Kahve Dünyası | IM30; 100; Satış; %60 | Eşleşme yok | — |
| 2027 / Sochic | A910SE; 100; Kiralama; %30 | SO CHIC: 2027-01 A80; 60; sale; %30; `c752ab7c-4ee1-4215-b2d4-5d914c9a9816` | — |
| 2027 / Gusto | A910SE; 80; Kiralama; %30 | GUSTO: 2027-06 A80; 60; sale; %30; `d6a72c08-b18e-4bd1-baca-5abec43bf184` | — |
| 2027 / SPX | A80; 65; Kiralama; %90 | Eşleşme yok | SPX: 2026-12 A80; 55; sale; %30; `e34a7de4-0995-49db-9b21-07243499f403` |
| 2027 / Arden FC | IM30; 50; Satış; %30 | Eşleşme yok | — |
| 2027 / Shaya | A6650; 50; Kiralama; %30 | Eşleşme yok | — |
| 2027 / Dagi | A910SE; 50; Kiralama; %30 | DAGİ: 2027-12 A80; 100; sale; %30; `6e12c84e-f5f2-4e4f-9884-731576e7afe5` | DAGİ: 2026-04 A6630; 15; sale; %90; `8d9e559b-6379-4fbc-8269-6a38fec6e58a` |

Aktif dışındaki 5 adet 2026/2027 kayıt da denetlendi: AVRASYA HOSPİTAL A80 50, ÇİÇEK RETAIL GROUP A80/S210 70, MAD PARFUM A80 100, ONUR MARKET A6630 160. Referans 15/17 satırı bu inaktif kayıtlarda bulunmuyor.
Tabloda doğrulanmış aynı firma+yıl+model+adet tam eşleşmesi yok. Aynı firma+model+adet ama farklı yıl örnekleri E-BEBEK A80 1.300 (2027-04, sale/%30), RAMSEY A6650 100 (2027-01, sale/%30), YVES ROCHER A6650 100 (2027-01, sale/%30). Bu kayıtları 2026’ya taşıma veya türlerini otomatik değiştirme gerekçesi bulunmuyor.
Katalog şemasında created_at/updated_at ve oluşturan/güncelleyen kişi alanları mevcut; source_id/import_key yok. Aktif/inaktif 274 kaydın hiçbir notu HTML dosya adı veya 16.10.2026 referansını taşımıyor. Oluşturulma günleri 07.09–14.10.2026 aralığında; bu, 16.10 tarihli plan görüntüsünün aynı sürümü olduklarını kanıtlamaz. Yeni ve manuel kayıtlar korunmalı.

## 2026/2027 sonuç tabloları: hesap ve fiyat farkları

- HTML 2026 kalan fırsatları model / satış-kira türü bazında toplar; olasılığı çarpan yapmaz. %100 senaryoda 5.186 cihaz Aralıkta görünür. Canlı projectRetail de olasılığı çarpmaz ve cari yıl planını Aralıkta gösterir; kaynak satır kümesi/türler farklı olduğundan sonuç farklıdır.
- HTML 2027 gömülü pipeline ay haritası ve CRM plan haritası boş; varsayılan 17 firma **Mart 2027** ayına yerleştirilir. CRM gömülü ek planı 0. Bu dosya taze tarayıcıda 6.595 cihazın tamamını Martta verir. Tarayıcının eski localStorage planları ayrıca görünümü değiştirebilir; bunlar HTML dosyası kanıtı değildir. Canlı aylar mevcut forecast_month değerleridir; Mart varsayımıyla ezilmemelidir.
- HTML %100 plan kira potansiyeli sabit A80=15, A910SE=17, A6650=20 USD tarife kullanır: 1.360×15 + 996×17 + 400×20 = **45.332 USD/ay**. Ekim hizmet + bu varsayım = **56.648 USD/ay**. Canlıda kira fiyatları null olduğu için aynı değer kanıtla üretilemiyor. Sabit tarifeyi uygulamaya gömmek yerine doğrulanmış sürümlü fiyat kaynağı gerekir.
- HTML 2026 satış 2.350×(111.220/221) A6650 + 80×(3.224/11) A920PRO ≈ **1.206.103,38 USD** ek satış tahmini; satış kaynağı mutabakatı tamamlanmadan canlı model ortalaması eşitliği beklenemez. Canlı kayıtların tüm unit_price alanları null; fallback yalnız doğrulanmış USD gerçekleşen model ortalaması. Yeni / satışı olmayan modelde fiyat uydurulmaz.
- Satış cirosu ve aylık hizmet/kira geliri ayrı ölçülerdir. Finans dahil et anahtarı varsayılan kapalıdır. Gerçekleşen ciro ve terminal değişmemeli; simülasyon ayrı eklenmeli.
- 2027 yarım adetleri model+ay toplamında yuvarlanır; canlı firma dağıtımı bu toplamı korur. HTML firma detayında her satırı ayrı yuvarlar; düşük senaryo oranında detay / matris farkı oluşabilir. Eşitlik için tek yuvarlama kuralı gerekir; mevcut kayıt adetlerini değiştirmek gerekmez.

## Eşitlik için veri kararı gerektirenler

1. Referans 2026/2027 plan sürümünü hangi kalıcı kayıt kümesinin temsil edeceği belirlenmeli. Referans satırlarına doğrulanmış customer/product kimliği + source/version bilgisi bağlanmalı; bu sırada ilgili olmayan aktif veya manuel forecast kayıtları korunmalı.
2. Her satırın satış / kiralama / banka kanalı, yılı, ayı, modeli, adedi, olasılığı ve fiyatı ayrı doğrulanmalı. Banka iş modeli referansta ayrı kategori; canlıda sale_type sale + sales_channel Banka iki alanla temsil edilir. Aynı cihazı Satış ve Banka toplamına iki kez dahil etmemek için sunum ölçü tanımı açık olmalı.
3. Ağustos fatura 183 USD farkı ve aktif kiralama iddiaları fatura / sözleşme belgesiyle onaylanmalı. Yalnız HTML kartına bakarak muhasebe kaydını değiştirmek veya sent teklifi active saymak uygun değildir.

## Kanıtlar ve değişiklik sınırı

- `.theme-audit/retail-review/nonsales-live.json`: 101 hizmet fatura hücresi, 15 stok kaynağı, 269 aktif forecast satırı, kiralama satış ve teklif kontrolü.
- `nonsales-extra.json`, `nonsales-inactive.json`, `nonsales-origins.json`: kaynak kimlikleri, kayıt zamanları, inaktifler ve alan varlığı; kişisel iletişim bilgisi rapora taşınmadı.
- `nonsales-compare.json`, `nonsales-reference-mapping.json`: statik/canlı toplam ve salt normalizasyonla firma aday eşleşmeleri.
- Canlı kaynak dosyaları (`retail-operasyon`, `kasapos-entegrasyon-shared`, `retail-rental`, `retail-projection`) yerel dosyalarla satır sonu normalize SHA256 seviyesinde eşleşiyordu.
- Kaynak DB değişikliği yapılmadı. Yalnız `fetchOpportunities` Retail kapsamı düzeltmesi ve regresyon testi yerelde eklendi.

## Denetim sonrası onaylanan kaynak ayrımı

Kullanıcı, referanstaki 32 satırın **ayrı Retail planı** olarak tutulmasını ve genel Forecast kayıtlarının değiştirilmemesini onayladı. Bu nedenle yukarıdaki departman filtresi ara düzeltmesinin yerini `loadRetailPlan([year, year + 1])` entegrasyonu aldı. Panel fırsat kaynağı artık `crm_retail_plan_entries`; boş plan yılında küresel Forecast'e dönüş yapılmaz. `businessModel` ile satış / kiralama / banka ayrımı ve `source=retail_plan` korunur. Yukarıdaki canlı sayılar denetim anındaki eski kaynakların kanıtıdır; onaylanan ayrı planın uygulama sonrası kabul kontrolü ayrıca yapılmalıdır. Gerçekleşen satış, KasaPOS ve aktif kiralama kaynakları bu ayrımdan etkilenmez.

## 20.10.2026 ek belge kontrolü: Ağustos ve kiralama

Bu ek, önceki Ağustos 183 USD farkı için yalnız tarife varsayımı olan açıklamanın yerine doğrulanmış kaynak kanıtını koyar. Kaynak: kullanıcı masaüstündeki `KasaPOS Entegrasyon Adet ve Tutarları 28092026.pdf` (28.09.2026, beş sayfa). Sayfa 4 görseli ayrıca incelendi.

- PDF sayfa 1, 2 ve 4 Ağustos aylık toplamını **9.021 USD** gösteriyor. Sayfa 3 MAD PARFUM Ağustos adedi **183**, sayfa 4 tutarı **1.464 USD**; dolayısıyla belge birim bedeli **8 USD**.
- 20.10.2026 05:07:43 UTC salt okunur kontrol: aktif fatura `PXS2026000000297`, kimlik `c562245b-233a-4fee-93bc-4f33ade8fc97`, kalem `65512263-7fde-4359-83c5-1418554aa56c`, dönem 2026-08-01, KasaPOS + TMS **183 × 8 = 1.464 USD**. Fatura güncelleme zamanı 21.09.2026; orijinal PDF tarihinden öncedir. Ağustos tüm uygun faturalar **1.249 adet, 9.021 USD**; toplam ve adet×birim fiyat eşit.
- Referans HTML grafik metnine **8.838 USD** sabiti yazılmış; orijinal PDF ve kanonik fatura **9.021 USD** ile uyumlu. Bu nedenle canlı fatura değerini 183 USD azaltmak veya Ağustos MAD bedelini 7 USD yapmak desteklenmiyor. HTML'nin bu sabiti hangi edit işleminde aldığı bilinmiyor; hatalı sabitin tarihsel üretim mekanizması kanıtlanmadı.
- MAD PARFUM **Eylül ve Ekim** kayıtları gerçekten 255 × 7 = 1.785 USD; Eylül güncelleme zamanı 13.10.2026. Sonraki dönemin 7 USD tarifesi geçmiş Ağustos faturasına geri uygulanmamalı. 28.09 PDF Eylül toplamı 11.017 USD'dir; sonraki HTML/canlı 10.628 USD farklı revizyon olduğundan bu belgeyi bütün aylara tek snapshot olarak zorlamak da doğru değildir.

### Nitel kiralama durumuna ilişkin CRM kanıtı

- TESPO, 09.10.2026 aktivite `2d21e9a3-759e-4b03-ad4a-1cdc94c3a595`: A910S parametre kurulumu tamam; SIM hatlarının açılması için operatörden bilgi bekleniyor. 08.10 aktivitesi cihaz teslimi ve SIM'in henüz aktif olmamasını doğruluyor. Bu, HTML'deki SIM takip notunu destekler; aktif satış/sözleşme/tahsilat kanıtı değildir. Teklif Q-2026-001 hâlâ sent, bağlı satış yok.
- EKOL GİYİM, 08.10.2026 aktivite `06304ef1-a77f-4dc5-9fa4-19c1dbc4892d`: yeni PAX platformunun aktif edildiği kayıtlı. 30.09 notu SIM kartların gelmiş fakat henüz açık olmadığı bilgisini taşıyor. Ağustos notları kiralama modeli hakkında görüşme ve sipariş talebini destekliyor. Teklif Q-2026-023 hâlâ draft ve kalem türü sale; bu operasyon notları tekliften aktif kiralama finansmanı yaratmaz.
- BR Mağazacılık adı AKBANK'ın 17.09 görüşme notunda ve NEBİM'in Ocak/Mart teknik notlarında geçiyor. Kanonik BR müşteri kaydı veya güncel “imza bekliyor” kiralama operasyon kaydı doğrulanmadı. Bu kayıtlar AKBANK/NEBİM'e bağlıdır; bu müşterileri BR ile birleştirmek yanlış olur.
- Nitel operasyon kartı ile doğrulanmış aktif kiralama sözleşmesi/KPI ayrı kalmalı. Aktivite “Tamamlandı” veya platform “aktif” ifadesi, `crm_sales.rental_ops_status=aktif` ve kira dönemi koşulları yerine geçirilemez. Kaynak DB ve plan kayıtları değiştirilmedi.

Ek kanıtlar (yerel, ignore edilmiş QA): `august-rental-evidence-20261020.json`, `br-name-evidence-20261020.json`, `kasapos-original-page4.png`.

