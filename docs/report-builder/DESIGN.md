# Report Builder — Tasarım

Durum: MVP (2026-10-19). Adres: `/crm/report-builder` (menüde yok). Mevcut rapor ekranları, API'leri ve `lib/reports` değiştirilmedi; yeni sistem yanlarında ayrı çalışır.

## 1. Envanter (Faz 1)

| Rapor / uç | Kaynak | Ana metrik | Not |
|---|---|---|---|
| performance-report | satışlar | ciro `sum(s.amount)` | para birimi ayrılmıyor |
| retail operasyon paneli | satış + kalem | USD kalem tutarı, cihaz adedi | kalemsiz satış cihaz adedine girmiyor (inner join) |
| kasapos-entegrasyon | hizmet faturası kalemleri | entegrasyon cihaz adedi / USD | fatura bazlı |
| kasapos-summary | teklifler | KasaPOS adedi | teklif bazlı → entegrasyonla farklı sayı |
| live-board / canlı ekran (/dashboard) | satış, pipeline | ciro ayrık para birimi, faz | faz grubu `musteri_pipeline` |
| drilldown | satış + kalem | cihaz adedi | retail ile aynı inner join kaybı |
| weekly-activities | aktiviteler | aktivite sayısı | `created_at`, saat dilimi yok, planlananlar dahil |
| user-activity-presentation | aktiviteler | aktivite sayısı | `'AKTIVITE:'` öneki + `created_at` |
| diğer aktivite raporları | aktiviteler | aktivite sayısı | `coalesce(aktivite_tarihi, created_at@Istanbul)`, planlananlar hariç |

### Mükerrerler
- **Cihaz adedi**: retail, drilldown, live-board üç ayrı SQL ile hesaplıyor.
- **KasaPOS**: summary (teklif) ve entegrasyon (fatura) aynı adı taşıyor, farklı kaynak.
- **Aktivite sayısı**: 3 farklı tarih/filtre tanımı.
- **Faz makro grubu**: kodda sabit + `musteri_pipeline`, iki kaynak.

### Metrik tutarsızlıkları → semantik katmandaki tek tanım
| Metrik | Eski farklar | Tek tanım (`lib/report-builder/datasets.ts`) |
|---|---|---|
| Ciro | TRY+USD karışık toplam / kalem USD | `amount_usd`, `amount_try` ayrı ölçü; karışık toplam yok |
| Cihaz adedi | yalnız kalem / device_count | kalem varsa kalem toplamı, yoksa `device_count` |
| Aktivite tarihi | created_at / aktivite_tarihi | `coalesce(aktivite_tarihi, created_at at time zone 'Europe/Istanbul')`, planlanan hariç |
| KasaPOS entegrasyon | teklif / fatura | `service_invoice_items.is_integration_device` (fatura); teklif bazlı ayrı ölçü olarak adlandırılır |
| Departman | rapor başına `is_kolu` filtresi | `department` boyutu = `musteriler.is_kolu` (tüm müşteri bağlı datasetler) |

### Yetki modeli
- Ekran: `screen.reports.view`. Dataset: action permission (`sale.read`, `quote.read` …).
- Satır kapsamı: `report.read.all` → tümü; yoksa **own** (sahip id/e-posta/ad). Takım modeli olmadığı için team = own.
- Yeni: `report.builder.design` (sayfa düzenleme), `report.letterhead.manage` (antet). `admin.users.manage` yedek. Migration seed admin/super_admin'e verir.
- Departman ayrımı **kişi bazlı değil departman bazlıdır**: satır kapsamından bağımsız filtre.

## 2. Mimari

```
UI (app/(panel)/crm/report-builder)  →  JSON tanım
   ↓ POST /api/report-builder/{query,pages/run,pdf}
lib/report-builder
   types.ts        zod tanım şeması (dataset, measures, dimensions, filters, dateRange, department, calculated, compare, viz)
   datasets.ts     semantik katman (SQL yalnız burada, beyaz liste)
   compiler.ts     tanım → parametreli SQL (+ satır kapsamı, tarih, departman, karşılaştırma)
   formula.ts      güvenli formül dili → SQL (AST, beyaz liste fonksiyon)
   executor.ts     statement_timeout, read-only tx, limit, karşılaştırma birleştirme
   page-types.ts   sayfa/widget/layout/antet şeması
   page-runner.ts  widget'ları eşzamanlılık 4 ile çalıştırır, sayfa filtresi + departman uygular
   pdf.ts          pdf-lib antetli PDF (saf, testli)
   pages-repo.ts / definitions-repo.ts  kalıcılık, sürüm, audit
```

### Motor güvenliği
- İstemci SQL göndermez; alan anahtarları regex `^[a-z][a-z0-9_]{0,63}$` + dataset beyaz listesi.
- Tüm değerler `$n` parametre + tip cast. Departman enum (`all|Retail|Vertical|Bank`).
- Formül: tırnak, `;`, `--`, `/*`, `$` reddedilir; ≤500 karakter, ≤200 düğüm, derinlik ≤24; bölme `nullif`.
- Limit ≤5000, `statement_timeout`, read-only transaction. Satır kapsamı derleyicide zorunlu eklenir.

### Tanım JSON (özet)
```json
{ "version": 1, "dataset": "sales", "measures": ["device_count","amount_usd"],
  "dimensions": [{"field":"sale_date","grain":"month"}],
  "filters": [{"field":"owner","op":"in","value":["Ali"]}],
  "dateRange": {"type":"relative","preset":"this_year"},
  "department": "Retail",
  "calculated": [{"key":"avg","label":"Ort.","formula":"DIV([amount_usd],[device_count])"}],
  "compare": "yoy", "visualization": {"type":"bar"} }
```

### Departman
- `department` boyutu tüm datasetlerde (`customerDims`), `business_line` geriye uyum için aynı ifade.
- Rapor tanımı: `department` (varsayılan filtre). Sayfa tanımı: `department` (varsayılan `all`).
- Öncelik: görüntüleyen seçimi (`values.department`) > widget sorgusunun kendi değeri > sayfa varsayılanı.
- Retail Operasyon şablonu `department: "Retail"`; görüntüleyen Tümü/Bank/Vertical'a geçebilir.

## 3. Kalıcılık (tek migration, `20261019_045_report_builder` bölümü)
- `report_definitions` (+ sürüm tablosu): tanım JSON, sahip, görünürlük (private/roles/everyone), favori.
- `report_pages` + `report_page_versions`: sayfa JSON, iyimser kilit (`baseVersion` → 409), sürüm geri yükleme yeni sürüm yazar.
- `report_letterheads`: bytea (≤5 MB, mime check), varsayılan için unique partial index, pasifleştirme (silme yok).
- Hepsi `IF NOT EXISTS`; DROP/DELETE yok. Audit: `tryRecordAuditEvent`.

## 4. Designer
- Paketsiz 12 kolon CSS grid, satır 56 px. Pointer ile taşı / sağ alt köşeden boyutlandır; klavye: ok = taşı, Shift+ok = boyut.
- Düzenler: `lg` (12), `md` (6, verilmezse lg'den ölçeklenir), `sm` (tek sütun, (y,x) sırası). Önizleme: Otomatik/Masaüstü/Tablet/Mobil.
- Widget: KPI/şerit, tablo, pivot, bar/line/pie (SVG), ısı tablosu (yeşil gerçekleşen / sarı tahmin, `forecastQuery`), metin, filtre, sekme.
- Stil: token renkleri (serbest hex yok), koşullu biçim, sayı formatı, sütun ayarları, yoğunluk, sayfa teması.
- Görüntüleme ve düzenleme modu ayrı; düzenleme `report.builder.design` + sahiplik.
- Renderer'lar `_components/renderers/` altında; `components/ui` ile değiştirilebilir (veri sözleşmesi `WidgetData` sabit).
- Şablonlar: `retail_operasyon`, `kasapos_entegrasyon` — JSON tanımla yeniden üretim testli (`page.test.ts`).

### react-grid-layout vs dnd-kit (kurulmadı)
| | react-grid-layout | dnd-kit |
|---|---|---|
| Amaç | hazır grid + resize + breakpoints | düşük seviye sürükle-bırak |
| Resize | var | yok (elle) |
| Erişilebilirlik | zayıf | iyi (klavye sensörü) |
| Boyut | ~ orta | küçük, modüler |
| Uyum | layout modeli bizimkine çok yakın (x,y,w,h) | sıralama listeleri için ideal |
Karar: MVP paketsiz. v2'de ihtiyaç olursa **react-grid-layout** (layout şeması birebir uyumlu, geçiş yalnız `PageDesigner` grid bölümü).

## 5. Antetli PDF
- pdf-lib + @pdf-lib/fontkit (mevcut). Antet: PNG/JPG tam sayfa veya tek sayfa PDF (`embedPdf`).
- A4 dikey/yatay, kenar boşluğu + güvenli alan (mm); içerik kutusu küçükse hata.
- Başlık, tarih, alt bilgi, `n / N`; tablo başlığı sayfa kırılımında tekrar; vektör bar/line/pie.
- Widget başına `hideInPdf`, `pageBreakBefore`. Yazdırma önizlemesi (iframe blob). Dosya adı `rapor-adi_YYYY-MM-DD.pdf`.
- Türkçe font: `public/fonts` (DejaVu) → `/usr/share/fonts/dejavu` → Windows Arial. **Prod için `public/fonts/DejaVuSans*.ttf` eklenmeli.**

## 6. Yol haritası

| Konu | MVP (bu) | v2 | v3 |
|---|---|---|---|
| Formül dili | aritmetik, IF, DIV/PCT/GROWTH, SHARE, RANK, RUNNING_SUM | tarih fonksiyonları, CASE, metin | kullanıcı tanımlı metrik kütüphanesi |
| Drill-down / cross-filter | — | tıklanan değer sayfa filtresine yazılır | hiyerarşi drill (yıl→ay→gün) |
| URL'de filtre | `?page=` | `?f.period=..&department=..` | paylaşılabilir kısa link |
| Zaman zekâsı | önceki dönem, YoY | hedef tablosu + gerçekleşme %, MTD/QTD | sezonsallık |
| What-if | — | parametre widget'ı (formülde `@param`) | senaryo kaydı |
| Zamanlanmış e-posta / alarm | — | `report_schedules` (cron, alıcı, PDF) | eşik alarmı (`report_alerts`) |
| Sürüm / audit | sayfa sürümü + audit | tanım diff görünümü | onay akışı |
| Sertifikalı metrik | semantik katman tek tanım | `certified` rozeti | metrik sahipliği |
| RLS / maskeleme | own/all kapsamı | takım kapsamı (takım tablosu gelince), alan maskeleme (`mask: true`) | Postgres RLS |
| Performans | timeout, limit | sonuç cache (tanım hash + kapsam, TTL), EXPLAIN maliyet sınırı | materialized view (aylık özetler) |
| Dışa aktarım | CSV, PDF | Excel (exceljs) | PPTX, TV modu (tam ekran döngü) |
| AI NL→tanım | — | sözleşme: model yalnız `reportDefinitionSchema` JSON üretir, aynı derleyici/yetkiden geçer; SQL üretmez | öneri + açıklama |
| Test / a11y / dark | vitest (derleyici, formül, sayfa, PDF), aria etiketleri, CSS değişkenleri | Playwright akış testleri | görsel regresyon |

## 7. Geçiş planı
1. MVP adresle açılır; pilot kullanıcılar Retail/KasaPOS şablonlarını mevcut raporlarla karşılaştırır (fark beklenen yerler §1 tablosunda).
2. Tutarlı çıkan raporlar için menüde yeni sayfaya bağlantı; eski ekran "eski" etiketiyle kalır.
3. İki sürüm eşleşince eski uçlar kullanım loguna göre emekliye ayrılır (silme ayrı onayla).

## 8. Gerekli paketler
Yeni paket yok. İsteğe bağlı (v2+): `react-grid-layout@1.5.x` (designer), `exceljs@4.4.x` (Excel).
