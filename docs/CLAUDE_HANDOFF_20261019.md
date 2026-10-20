> **20 Ekim 2026 güncellemesi:** Bu dosya 19 Ekim'deki tarihsel durumu anlatır. İş tekrar sürdürüldü; tip/yetki alanı tamamlandı, migration049 uygulandı,32plan+530üyelik aktarıldı ve4tutar onarımı canlıda uygulandı. Genel Forecast/müşteri hash'leri aynı. bebed09 canlı;63dosya/522test ve public/internalhealth başarılı. Güncel kanıt ve kalan kaynak farklılıkları: docs/report-builder/RETAIL_LIVE_ACCEPTANCE_20261020.md. Aşağıdaki “uygulanmadı/TypeScript hatası” ifadeleri artık güncel değildir.
# Claude devir notu — 19 Ekim 2026

## Önce bunu oku
Kullanıcı token sınırı nedeniyle işi Claude'a devretmemizi istedi. Geliştirme ve tüm ajanlar durduruldu; mevcut dosyalar kaydedildi. **Aşağıdaki Retail değişiklikleri tamamlanmadı, commit edilmedi ve canlıya alınmadı.** Çalışma ağacını sıfırlama; untracked dosyaları da koru. Kullanıcı verisine henüz hiçbir onarım/plan aktarımı uygulanmadı.

Repo: `D:\Repos\CRM\CRM YENİ UI\CRM YENİ UI`. Önce `.claude/CLAUDE.md` ve kullanıcının AGENTS.md talimatlarını oku. Kod keşfinde codebase-memory-mcp öncelikli. Yeni paket yok. .env/secret içeriklerini okuma. Çıktıları kısa tut.

## Kullanıcının kesin beklentisi
- `Retail_2026_2027.html` altı sekmenin **üst ve alt bütün alanları** referanstır. Aynı tarih/kapsam/veri ile sonuçlar eşit olmalı.
- Model, adet, yıl/ay, olasılık ve **Satış / Kiralama / Banka** anlamları değiştirilmemeli. Kiralama satışa çevrilmemeli. Genel Forecast kayıtlarının üstüne referans değerleri yazılmamalı.
- Kullanıcıya şu karar soruldu ve açıkça onaylandı: **“Referansı ayrı Retail planı olarak aktar.”** Referanstaki 32 plan satırı ayrı, kalıcı ve düzenlenebilir canlı CRM tablosuna aktarılacak; client içine statik müşteri dizileri gömülmeyecek.
- Kiralama kayıt girişi mevcut Teklifler → Satışlar yapısında kalmalı; paralel yeni kiralama giriş sistemi kurma.
- Özel rapor tarafı daha önce geliştirilip canlıya alındı; yeni çalışma esasen Retail veri mutabakatı ve ayrı plan kaynağıdır.

## Son canlı durum
- Son commit/yerel HEAD: **2cfa4fc** `Validate report catalog responses before opening the designer`.
- Bu commit sunucuya çekilip standart script ile deploy edildi. Sunucuda **58 test dosyası / 480 test**, build, preflight geçti. PM2 reload ve internal health başarılı.
- Son deploy logu: `/tmp/codex-report-designer-crash-20261019.log`.
- Yedek: `backups/predeploy-20261019-140403.dump`.
- Bu düzeltme, HTTP200 olup liste alanı eksik yanıtın state'e undefined yazıp Studio'da `Cannot read properties of undefined (reading 'find')` üretmesini engelliyor. Gerçek komponent browser testinde HTTP200 `{}` antet yanıtıyla hata üretildi; düzeltme sonrası Studio açıldı. Bunun kullanıcının canlı stack'iyle kesin aynı köken olduğu ayrıca kanıtlanmadı; canlı AD oturumu mevcut değildi.
- API list contract guard: `_components/api-contract.ts`, `.test.ts`, `api.ts`; `friendly.ts` invalidResponse mesajını gösterir. 13 regresyon testi geçti.

## Erişim / deploy
- SSH key: `tahabitim@10.250.50.39`.
- App: `/home/tahabitim/apps/pax-retail-crm`; PM2 `pax-retail-crm`; port 5043.
- Kullanıcı URL: `https://crm.paxturkiye.com:5042`.
- Standart yöntem: commit/push `origin main`; SSH app içinde `git pull --ff-only && bash scripts/deploy-live.sh > /tmp/ANLAMLI_LOG.log 2>&1`.
- Script npm ci → verify → DB preflight → zorunlu backup → migration → PM2 reload → health uygular. Migration/table hazır olmadan yeni rapor loader'ını canlıya açma; importer sırasını planla.
- Sağlık: `curl.exe --max-time 20 -fsS https://crm.paxturkiye.com:5042/api/health`.
- DB okuma için süreç env yüklemesi kullanılabilir: `node --env-file-if-exists=.env.local ...`; .env içeriklerini çıktı alma. Audit sorguları BEGIN READ ONLY idi.

## Asıl referans / tarayıcı
`C:\Users\mustafa.bitim\OneDrive - Pax Teknoloji\Masaüstü\Retail_2026_2027.html`.
Orijinal dosya değiştirilmedi. İnceleme kopyası ignored `.theme-audit/retail-review/reference-retail.html`.
Yerel Vite QA sunucusu 5178 halen çalışıyor olabilir. Referans tarayıcıda `http://127.0.0.1:5178/reference-retail.html` üzerinden açıldı; 1–6 sekmeler ve 4/5/6 sekmelerin alt tabloları gezildi. Yalnız üst kartlarla karşılaştırma yapılmadı. AD ile canlı görsel oturum yapılmadı.

## Kanıtlanmış satış / ciro farkı
Detay: `docs/report-builder/RETAIL_REVENUE_RECONCILIATION.md`, `RETAIL_SALES_MONTHLY_PARITY.md`.
- HTML **404.636,00 USD**, canlı satış kalemleri **326.257,46 USD**; fark **78.378,54 USD**.
- 23 firma, 6 model, 72 model×ay hücresi incelendi. Terminal **1.432**, S210 aksesuar **678**: bütün adetler eşit. Diğer 11 ayın cirosu eşit; fark Haziran'da.
- Dört eski import tutarı yanlış; HTML'nin kendi alt notu da binlik ayırıcı düzeltmesini açıkça belgeliyor:
  - import107 DAGİ A6630: 6,08 → **6.075** (15×405)
  - import109 LEE COOPER S210: 2 → **2.002** (26×77)
  - import111 MAD PARFUM A80: 50,74 → **50.745** (255×199)
  - import112 MAD PARFUM S210: 19,64 → **19.635** (255×77)
- İlgili 3 satış başlığı da eşzamanlı düzeltilmeli. Sadece ekranda toplamı sabitleme.
- **M&S-GAP** başlığı 225 USD, kalemleri 2.184 USD: ayrı bir anlaşma override farkı **1.959 USD**; bunu otomatik düzeltme. Başlık toplamı şu an 324.298,46; dört import onarımından sonra 402.677 olur. Retail kalem toplamı 404.636 olur. Kaynak/grain ayrımını saklama.
- Lee A80 tutarı **7.202** kaynak anlaşmasıdır; qty×unit farklı olsa da bilerek korunur.

### Hazır ama uygulanmamış onarım
`scripts/repair-retail-2026-import-amounts.mjs`:
- Varsayılan READ ONLY preflight.
- `--apply --backup YENİ_DOSYA` olmadan yazmaz.
- 4 staging +4 item +3 head; sabit UUID, eski tutar, qty, unit, import kaynağı, müşteri ve tarih drift guard'ları; SERIALIZABLE/FOR UPDATE; her update rowCount1; commit öncesi mutabakat.
- Backup: sadece id/tutar, exclusive yeni dosya ve 0600; rollback dry-run / explicit apply destekli.
- Bağımsız ajan incelemesi yapıldı, bloklayıcı sorun bulunmadı. Sonradan frozen customer/date + son metadata readback koruması da eklendi.
- Üretim READ ONLY preflight geçti; lokal fakeDB dry/apply/drift testleri geçti. **Apply canlıda çalıştırılmadı.** Kaynak dosyayı tekrar incele; tam DB yedeği de al.

## Forecast / plan farkı — sadece türü değiştirmek yetmez
Detay `RETAIL_NONSALES_RECONCILIATION.md`.
- HTML2026: **15 firma / 5.186**, Satış2.430 / Kiralama2.756.
- HTML2027: **17 firma / 6.595**, Satış1.250 / Kiralama4.845 / Banka500; varsayılan Mart.
- Canlı genel Forecast kayıtlarında yıl/model/adet/olasılık da farklı; 269 aktif satırın tümü sale, fiyatlar null. Aynı yıl/model/adetle referansın 32 satırını birebir eşleyen kayıt yok. İnaktif kayıtlar da kontrol edildi.
- Eski panel global Forecast'i çekerek Bank/Vertical verilerini de karıştırıyordu. Şimdi uncommitted loader ayrı Retail tablosuna geçirildi; global Forecast fallback yok.
- Bunun için kullanıcının ayrı Retail planı aktarımı onayı alındı.

## Şu an yerelde hazırlanmış, tamamlanmamış kod
### DB
`db/migrations/20261019_047_report_builder.sql` sonuna **append marker** eklendi:
`-- CRM_APPEND_MIGRATION: 20261019_049_retail_reference_plan.sql`
İki tablo: `crm_retail_plan_entries` ve `crm_retail_pool_memberships`.
- Daha önce uygulanmış migration byte prefix/checksum'larını koru; dosyanın tamamını yeniden formatlama.
- Migration canlıda uygulanmadı. `scripts/migrate.mjs` append marker'ı tanıyor.

### Backend / importer
- `lib/reports/retail-plan.ts`, `.test.ts`
- `app/api/reports/retail-plan/[id]/route.ts`
- `scripts/retail-reference-plan-parser.mjs`, `.test.ts`
- `scripts/import-retail-reference-plan.mjs`
- Loader ayrı 32 plan satırını okur; source/businessModel/updatedAt/reference bilgisi taşır.
- PATCH, gerçek `forecast.write.any` yetkisi ve optimistic `expectedUpdatedAt` kontrolü kullanır. Canonical Forecast/customer kayıtlarına yazmaz.
- Importer: `--source HTML [--include-pool] [--customer-map JSON] [--apply --backup NEW_FILE]`.
- Default dry-run. 32 plan + `--include-pool` ile 530 CRM üyeliği. Stable reference keys; var olan kullanıcı düzenlemesini ezmez; source SHA farklılığına guard var.
- 32 planın customer_id alanı explicit reviewed map yoksa null olabilir; firm_name/model/tür aynen korunur. Bu finansal satış oluşturmaz.
- 530 CRM üyeliği için tam Türkçe ad+trim eşleme geliştirildi; audit identity snapshot üzerinde 530 eşleşti. Gerçek yeni tablolarla canlı dry-run henüz yapılmadı. Ambiguous eşlemeyi zorla çözme.
- Parser/backend/integration **24/24** hedefli test geçti. Importer apply dalı gerçek DB'de test edilmedi; backup/idempotency/row assertions ayrıca incelenmeli.

### Panel kaynakları / frontend
- `lib/reports/retail-operasyon.ts`, `.test.ts`: ayrı plan loader; CRM pool üyelik tablosu; canonical customer_id join. 7 backend test ve hedefli lint geçti.
- `lib/reports/retail-projection.ts`, `.test.ts`: bank ayrı; businessModel öncelikli; 6.595=1.250+4.845+500 testi. **11 hesaplama testi geçti.**
- `RetailOperasyonClient.tsx`, `RetailResults.tsx`, yeni `RetailPlanEditor.tsx`, `retail-operasyon.module.css`.
- Plan düzenleme modalı ve 2027 ay değişimi Retail PATCH'e gider; existing Forecast fallback yalnız eski source içindir. Banka toplam adede dahil, satış/kira USD'ye dahil değil. Rental rates referans metadata'sından gelir.

### Bilinen kesin kalan derleme hatası — ilk bunu düzelt
**TypeScript şu an geçmiyor**: RetailOperasyonClient satır106/136/137/200 `data.canEditRetailPlan` okuyor ama `RetailOperasyonPayload` tipinde alan eksik.
1. `RetailOperasyonPayload` tipine `canEditRetailPlan?: boolean` ekle.
2. `app/api/reports/retail-operasyon/route.ts` içinde yetkili user'ı alıp `canEditRetailPlan(user)` sonucunu JSON payload'a ekle. Sadece tipe ekleyip true hardcode etme.
3. Backend/client PATCH alanları son kez karşılaştır: planMonth, quantity, productCode, businessModel, probability, note, unitPrice, rentalMonthlyPrice, expectedUpdatedAt.
4. Son UI şema hizalamalarından sonra lint/typecheck/browser QA tekrar gerekli.

## CRM pool farkı / neden üyelik tablosu var
`RETAIL_CRM_POOL_PARITY.md` ayrıntılı.
- Referans530; mevcut tümRetail müşteri551. Ortak480; referansın kalan50si mevcut CRM'de Vertical. Silinmiş değiller.
- Canlıdaki ek71firmanın42si başka referans satış/projeksiyon/KasaPOS listelerinde; tümRetail departmanı referansın “Projeksiyon dışı havuz” kapsamı değil.
- Referans CRM statüleri Lead441/Hunter65/Kasa20/Farmer4; canlı eski mapper ayrıntılı pipeline fazını yanlış alan yerine gösteriyordu. Ayrı üyelikte original retail_status korunacak; canlı pipeline fazı farklı bilgi.
- 34 kasa grubu farkı: HTML bazı Enpos/Smartpos vb ham sağlayıcıları Inhouse altında gruplayarak gösteriyor. Canonical CRM ham veriyi ezme; üyeliğin register_vendor_group alanı rapor grubu, rawKasa mevcut ham değer.
- Müşteri sektör/adet/POS/sahiplik/banka/Account ortak480de aynı. Join fanout yok.
- HTML'nin kendi küçük tutarsızlığı: D.crm530 ve Bilinmeyen374; eski D.kcounts chart531/Bilinmeyen375 (Hepsijet duplicate gizlenmesi grafiğe yansımamış). Canlıda531 fake müşteri üretme;530tekil satırdan grafik hesapla ve bu farkı açıkla.

## Diğer henüz çözülmeyen alanlar
- KasaPOS üst KPI ve15firma adetleri aynı. Ağustos gelir HTML8.838 vs canlı9.021: **183 USD** fark. MAD183×8 yerine×7 farkı aritmetik olarak açıklıyor ama fatura kanıtı yok; tarife uydurarak değiştirme. Kaynağı doğrula.
- Kiralama referansında TESPO/EKOL aktif, BR imza bekliyor nitel notları var. CRM'de TESPO rental teklif sent, satış yok; EKOL draft sale; BR net kanonik eşleme yok. Bunları aktif sözleşmeye/faturaya dönüştürme. Referansın alt finans tablosu da doğrulanmış aktif kira adet/tahsilat olmadığını söylüyor. Nitel operasyon notları için ayrı referans/provenance modeli veya kullanıcı teyidi gerekiyor; mevcut aktif kira KPI0 kaynağa göre doğru.
- Altı sekmenin tamamının üretim verisiyle son tam karşılaştırması henüz bitmedi. Özellikle ayrı plan importundan sonra2026/2027 bütün modeller/aylar/senaryo yüzdesi/finans dahil etme/kira bedelleri/banka ayrımı yeniden doğrulanmalı.

## Önerilen kalan sıra
1. Çalışma ağacındaki dosyaları koru; tüm untracked dosyaları incele. Eksik canEdit alanını ve API izin JSON'unu tamamla.
2. Importer/migration uyumunu ve apply/backup/idempotent dallarını gözden geçir. Hedefli testler ardından `npm run verify`.
3. Gerçek component QA'da aynı HTML32plan+530üyelik fixture ile bütün6sekmeyi alttaki tablolar dahil gez. Salt üst KPI yeterli değil.
4. Standart deploy/backup/migration; gerçek DB importer **dry-run**, sonuç32/530 ve tam tutarlar kontrolü. Ardından kullanıcı onayı kapsamındaki ayrı plan aktarımını kontrollü apply et. GenelForecast'i değiştirme.
5. Dört kanıtlanmış tutar onarımının backup/dry-run/apply ve sonread-only mutabakatı;404636 kalem cirosu ve1432+678 adet doğrula. M&S/LeeA80 korunmalı.
6. KasaPOS183 ve nitelkiralama belirsizliklerini kanıtsız overwrite etme. Tamamlandı diye raporlama.
7. Canlıhealth, yeniendpointRBAC/optimisticlock ve AD oturumlu görsel kontrol; devir belgelerini gerçek durumla güncelle.

**Bu devir anında yeni Retail tabloları/32plan/530üyelik/4tutar onarımı canlıya uygulanmış değildir.**
