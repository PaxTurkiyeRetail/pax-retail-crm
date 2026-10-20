# Retail canlı kabul — 20 Ekim 2026

## Uygulananlar
- 7653013: ayrı Retail planı ve rapor müşteri kapsamı; append migration049 uygulandı.
- 88b9b4b: salt okunur kaynak/veri doğrulama aracı.
- bebed09: havuzdan yeni ekleme de ayrı Retail planına gider; genel Forecast değişmez.
- 32 referans planı ve530 müşteri üyeliği kaynak SHA256 ile aktarıldı. Referans müşteri/tür/yıl/ay/model/adet/olasılık/not ve2026 kiralama tarifeleri korunur.
- Plan düzenleme izin kontrollü ve optimistic updatedAt kontrolüyle çalışır. Yeni plan aktif katalog ve havuz üyeliğiyle sunucuda doğrulanır.

| Kontrol | Referans | Canlı doğrulama |
|---|---:|---:|
|2026 gerçekleşen USD ürün cirosu|404.636,00|404.636,00|
|Terminal (S210 hariç)|1.432|1.432|
|S210 aksesuar|678|678|
|Satış firması|23|23|
|2026 plan firma / adet|15 /5.186|15 /5.186|
|2026 satış / kiralama|2.430 /2.756|2.430 /2.756|
|2027 plan firma / adet|17 /6.595|17 /6.595|
|2027 satış / kiralama / banka|1.250 /4.845 /500|1.250 /4.845 /500|
|CRM kapsamı|530|530|
|KasaPOS aktif / faturalanan|2.513 /1.598|2.513 /1.598|
|KasaPOS Ekim aylık USD|11.316|11.316|

Dört eski aktarım tutarı4staging+4kalem+3başlıkta yedekli SERIALIZABLE işlemle onarıldı; fark+78.378,54USD. M&S225USD anlaşma başlığı ve LeeA807.202USD kaynak anlaşması değiştirilmedi. M&S nedeniyle satış başlık toplamı402.677USD, bu raporun ürün-kalem toplamı404.636USD; aynı ölçüymüş gibi eşitlemeyin.

Genel Forecast275 ve müşteri719 kaydının aktarım öncesi/sonrası tüm-satır hash'leri aynı kaldı:
- Forecast: b8b7de30fef712b0e530eba70accf7ef
- Müşteri: 3502b5530cad4479b1f84ab823fb31fa

## Kaynak farkları / sınırlar
- HTML Ağustos KasaPOS8.838USD; orijinal PDF(sayfa4) ve aktif fatura9.021USD, MAD PARFUM183×8=1.464USD. Canlı belgeye uygun9.021 korundu; tutar düşürülmedi.
- Referansın eski kasa dağılımı531/Bilinmeyen375 iken tekil müşteri tablosu530/Bilinmeyen374. Hayalî müşteri eklenmedi; grafik gerçek530satırdan hesaplanır.
- TESPO/EKOL operasyon/SIM notları CRM'de var, aktif kiralama sözleşmesi/tahsilatı yok. BR'nin imza durumu kanıtlanmadı. Bu nitel notlardan aktif finansal kira kaydı oluşturulmadı.
- AD ile canlı görsel giriş yapılmadı. Gerçek React bileşenleri32/530referans fixture ile6sekme, alttaki tablolar, banka ayrımı, PATCH sürümü/409, readonly, mobil ve havuzdan ekle→2027 aylıkta görünme akışıyla doğrulandı.
- Canlı DB üzerinde kaynak panel sorgusu ve tüm referans alanları salt okunur doğrulandı. Create+PATCH gerçekSQL'i açıktransaction içinde test edilip ROLLBACK yapıldı; test satırı kalmadı.

## Yedek / tekrar doğrulama
Sunucu app: /home/tahabitim/apps/pax-retail-crm
- İlk deploy tamDB yedeği: backups/predeploy-20261020-051410.dump
- Kaynak ve işlem yedekleri(0700dizin/0600dosyalar): backups/retail-reference-20261020/
- Aktarım öncesi: plan-import-before.json ve .inserted.json
- Tutar onarımı öncesi: sales-repair-before.json
- Referans kaynağı: reference.html (SHA256 2f277d3376db880f15d2840f9f31266c716f0193768e22f5f38fc22ab6fd69d6)
- Yeniden importer dry-run: toInsert0, preserved32, poolToInsert0, preserved530.
- Salt okunur doğrulama: node --env-file-if-exists=.env.local scripts/verify-retail-reference-parity.mjs --source backups/retail-reference-20261020/reference.html
Bu doğrulayıcı orijinal32referans anahtarını kontrol eder. Kullanıcının bu satırlarda bilinçli düzenlemesi sonrasında kaynakla fark beklenebilir; snapshotları körlemesine geri yüklemeyin.

Son ekleme endpoint'i bebed09 ile canlı:63testdosyası/522test,typecheck/lint/build geçti. İkinci tamDB yedeği backups/predeploy-20261020-052624.dump. Internal+publicHTTPShealth başarılı; son saltokunur doğrulama32/530/404636vecanonicalhash'leri tekrar onayladı.

> Historical import acceptance only: superseded by RETAIL_LIVE_ACCEPTANCE.md. All six runtime tabs now use canonical live CRM; archived reference rows remain untouched.
