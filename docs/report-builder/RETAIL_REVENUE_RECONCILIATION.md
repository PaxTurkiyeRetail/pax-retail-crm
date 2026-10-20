# Retail 2026 gelir mutabakatı

Firma, model ve ay bazındaki satış kapsamı için [2026 satış / aylık gerçekleşen eşitliği](RETAIL_SALES_MONTHLY_PARITY.md) belgesine bakın. Forecast, KasaPOS ve kiralama dahil altı sekmenin genel incelemesinde bu belge satış cirosunun ayrıntılı kanıtıdır.

Read-only canlı DB işlemi: BEGIN READ ONLY; kaynak veya veri değişikliği yapılmadı.

Statik HTML: **404.636,00 USD**. Canlı aktif 2026 satış kalemleri: **326.257,46 USD**. Fark: **78.378,54 USD**.

| Firma | Terminal adedi (statik/canlı) | HTML USD | Canlı USD | Fark USD |
|---|---:|---:|---:|---:|
| KİĞILI | 500 / 500 | 93.500,00 | 93.500,00 | 0,00 |
| BEYMEN | 192 / 192 | 93.270,00 | 93.270,00 | 0,00 |
| SUWEN | 224 / 224 | 62.856,00 | 62.856,00 | 0,00 |
| YARGICI | 78 / 78 | 24.594,00 | 24.594,00 | 0,00 |
| PARAMTECH | 30 / 30 | 10.965,00 | 10.965,00 | 0,00 |
| BG STORE | 35 / 35 | 9.010,00 | 9.010,00 | 0,00 |
| LEE COOPER | 26 / 26 | 9.204,00 | 7.204,00 | 2.000,00 |
| ÇİFT GEYİK KARACA | 26 / 26 | 6.256,00 | 6.256,00 | 0,00 |
| METİS YAZILIM | 7 / 7 | 4.928,00 | 4.928,00 | 0,00 |
| MISSHA | 13 / 13 | 2.431,00 | 2.431,00 | 0,00 |
| M&S - GAP | 7 / 7 | 2.184,00 | 2.184,00 | 0,00 |
| MARKAPARK | 3 / 3 | 2.112,00 | 2.112,00 | 0,00 |
| SCHAFER | 3 / 3 | 1.902,00 | 1.902,00 | 0,00 |
| FİBA RETAIL | 4 / 4 | 1.040,00 | 1.040,00 | 0,00 |
| MAD PARFUM | 258 / 258 | 71.313,00 | 1.003,38 | 70.309,62 |
| ÇİÇEK RETAIL GROUP | 3 / 3 | 933,00 | 933,00 | 0,00 |
| PAKKOD | 2 / 2 | 730,00 | 730,00 | 0,00 |
| COLUMBİA | 3 / 3 | 561,00 | 561,00 | 0,00 |
| VERİMSOFT | 0 / 0 | 231,00 | 231,00 | 0,00 |
| SNEAKS UP | 1 / 1 | 187,00 | 187,00 | 0,00 |
| ALTINYILDIZ | 1 / 1 | 187,00 | 187,00 | 0,00 |
| NEXİVOX YAZILIM | 1 / 1 | 167,00 | 167,00 | 0,00 |
| DAGİ | 15 / 15 | 6.075,00 | 6,08 | 6.068,92 |

23 firmanın tamamı eşleşti; 20 firmanın cirosu birebir aynı. Tüm terminal adetleri aynı (1.432). Fark yalnız MAD PARFUM, DAGİ ve LEE COOPER kayıtlarında.

## Veri onarımı önerisi — uygulanmadı

| İçe aktarım anahtarı | Kalem | Mevcut toplam USD | Beklenen toplam USD | Dayanak |
|---|---|---:|---:|---|
| 107 | DAGİ A6630 | 6,08 | 6.075,00 | 15 × 405 |
| 109 | LEE COOPER S210 | 2,00 | 2.002,00 | 26 × 77 |
| 111 | MAD PARFUM A80 | 50,74 | 50.745,00 | 255 × 199 |
| 112 | MAD PARFUM S210 | 19,64 | 19.635,00 | 255 × 77 |

Anahtarların tam öneki pivot-10.09.2026-. 028 migration ve canlı staging tutarları aynı. 030 migration bu tutarları kalemlere aynen taşır. Öneri dört staging satırı + dört kalem + üç satış başlığını kontrollü tek işlemde düzeltmektir. İlgili satış başlıkları DAGİ 6.075, LEE COOPER 9.204, MAD PARFUM 29 Haziran 70.380 USD olur. MAD PARFUM 24 Eylül 933 USD kaydı zaten doğrudur. Orijinal Excel dönüşüm kodu bulunmadığından binlik ayırıcı hatasının tam mekanizması kanıtlanmış değildir.

## Başlık ve kalem tanımı

Canlı 2026 satış başlıkları 324.298,46 USD, kalem toplamı 326.257,46 USD. 1.959 USD farkın tamamı M&S - GAP: başlık 225, kalem 7 × 312 = 2.184. createDirectSale anlaşma tutarının başlığı ezmesine izin verir, kalemler katalog toplamında kalır. Bu fark belgesiz otomatik düzeltilmemelidir. CRM genel ciro tanımı aktif satış başlığıdır; Retail kalem bazlı görünümü mevcut tanımıyla farklı bir toplam üretir. Yukarıdaki üç firma onarılırsa kalem toplamı 404.636 USD, mevcut başlık tanımı 402.677 USD olur.

2026 aktif 38 satışın tamamı USD ve Retail departmanındadır; kalemsiz satış yoktur. Tüm aktif 2026 kayıtlar direct kaynağındadır. İptal SUWEN kaydı 57.600 USD olup statik ve canlı aktif toplamın dışındadır. Aktif aynı quote_id için mükerrer satış yoktur. Yıl/departman/kur/kalemsiz kayıt/tekliften dönüşüm farkı bu 78.378,54 USD açığı açıklamaz. S210 aksesuar cirosu her iki tarafta dahildir; terminal adedinde hariçtir.

Kanıt dosyaları: revenue-live.json (canlı özet ve dört firma kalemleri), revenue-firm-reconciliation.json (23 firma). Kaynaklar: lib/reports/retail-operasyon.ts fetchSales; db/migrations/20260910_028_satis_pivot_ice_aktarim.sql; db/migrations/20260911_030_satis_kalemleri.sql; lib/quotes/sales-service.ts createDirectSale.

## Gözden geçirilebilir onarım komutu

Script: `scripts/repair-retail-2026-import-amounts.mjs`. Üretimde yalnız varsayılan read-only preflight çalıştırıldı ve geçti: 4 staging satırı, 4 kalem, 3 başlık; beklenen fark +78.378,54 USD. Üretimde `--apply` çalıştırılmadı. Kaynak dosyaya gömülü tarihsel migration değiştirilmedi.

Repo dizininde, mevcut bağlantı ayarlarını ekrana dökmeden:

```sh
# Varsayılan: READ ONLY; veri ve backup dosyası yazmaz.
node --env-file=.env.local scripts/repair-retail-2026-import-amounts.mjs

# Yalnız somut veri onarımı onaylandıktan sonra:
node --env-file=.env.local scripts/repair-retail-2026-import-amounts.mjs --apply --backup /home/tahabitim/backups/retail-2026-import-before.json

# Geri alma ön kontrolü (read-only):
node --env-file=.env.local scripts/repair-retail-2026-import-amounts.mjs --rollback /home/tahabitim/backups/retail-2026-import-before.json

# Geri alma ancak ayrı açık yürütme kararıyla:
node --env-file=.env.local scripts/repair-retail-2026-import-amounts.mjs --rollback /home/tahabitim/backups/retail-2026-import-before.json --apply
```

### Ön koşullar ve geri alma koruması

- Uygulama öncesinde dört önerilen tutar kaynak belgeyle/onayla doğrulanmalıdır; genel `adet × birim fiyat` normalizasyonu yapılmaz. LEE COOPER A80 için 7.202 USD korunur; bu satırın 26 × 211 tutarı farklıdır ve ayrıca belge kontrolü gerektirir.
- Sabit satış, kalem ve müşteri UUID'leri; sabit incelenmiş 2026 satış günleri; benzersiz staging `import_key`; staging → satış → müşteri bağlantıları; eski tutarlar; miktar ve birim fiyatlar eşleşmelidir. İlgili üç satış aktif, USD, direct/manual ve import kaydı olmalıdır; teklif bağlantısı olmamalıdır. Satışların toplam beş kalemli yapısı ve değişmeyen LEE COOPER A80 tutarı doğrulanır. Commit öncesinde staging/kalem/başlık satırlarının incelenmiş tüm metadata alanları DB'den yeniden okunur; hedef tutarlar dışındaki alanların değişmediği kontrol edilir.
- `--apply` serializable tek transaction ve satır kilitleri kullanır; 5 saniye kilit/20 saniye sorgu zaman aşımı vardır. Her güncelleme beklenen eski tutarı koşula ekler ve tam bir satır değiştirmelidir. Dört staging, dört kalem ve üç başlık dışında update yoktur. Her başlığın son kalem toplamı kontrol edilmeden commit yapılmaz; herhangi bir hata rollback eder.
- Yazmadan önce yeni, üzerine yazılamayan backup dosyası oluşturulur (`wx`, Unix izin 0600). İçerik yalnız değişen satır kimlikleri ve eski tutarlardır; kişi adı, not ve bağlantı sırrı içermez. Backup oluşturulamazsa transaction ilerlemez. Backup yolu repo dışında ve erişimi sınırlı olmalıdır.
- Geri alma aynı sabit kayıtları, backup kimlik/tutarlarını ve uygulama sonrası beklenen tutarları doğrular. Sonradan miktar/fiyat/tutar değişmişse eski backup körlemesine uygulanmaz. İkinci kez onarım çalıştırmak da eski değer ön koşulunda durur.
- M&S - GAP 225 USD başlık / 2.184 USD kalem override kaydı, MAD PARFUM Eylül 933 USD satışı, iptal SUWEN kaydı ve tüm teklifler değişmeden kalır. Tarihsel migration yeniden yürütülmemelidir; 030 migration yeniden yürütmesi tüm import başlıklarını kalem toplamına göre yeniden hesaplayabilir.

Scriptin canlı dry-run sonucu: `{"mode":"repair","apply":false,"stagingRows":4,"itemRows":4,"saleHeads":3,"deltaUsd":78378.54,"readOnly":true,"preflight":"passed"}`. `node --check` başarılıdır. Yerel sahte DB smoke doğrulaması dry-run (değişiklik yok), apply (backup ve 11 satır güncellemesi) ve eski tutar sapmasında rollback kollarını doğruladı. Üretimde apply/rollback yürütme kolları denenmedi; yürütme öncesi ikinci kod incelemesi önerilir.
