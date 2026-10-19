# components/ui — Tasarım sistemi

Veri odaklı, sade arayüz (Linear / Stripe Dashboard çizgisi). Ekranlar **yalnızca** bu bileşenleri kullanır:
ekrana özel CSS dosyası, `<style>` bloğu, `style={{}}` ve sınıf içinde ham hex yok.

## İlkeler
- Nötr gri skala + tek vurgu (`accent`). Durum renkleri: `ok`, `warn`, `danger` (+ `*-soft`).
- Köşe 0–4px (`rounded-[3px]`). Gölge, gradient, emoji, pastel dolgulu rozet, hero başlık yok.
- Kart yerine 1px ayraç (`border-border`).
- Gövde 13px, sayılar `tabular-nums` ve sağa hizalı.
- Dokunma hedefi mobilde ≥40px (`h-10`), `sm`'den itibaren yoğun (`h-8`).
- Mobil: 16px kenar boşluğu, sayfa yatay kaymaz; tablolar kendi kabında kayar, KPI 2 sütun, menü çekmece.
- Breakpoint kontrolü: 360 / 390 / 768 / 1024 / 1440, açık + koyu tema.

## Token'lar
`app/tailwind.css` → `:root` / `[data-theme="dark"]` CSS değişkenleri, `@theme inline` ile Tailwind rengine bağlı.
Sınıflar: `bg-app-bg bg-surface bg-surface-2 border-border border-strong text-text text-text-2 text-text-3 text-text-4
accent accent-soft ok warn danger *-soft bg-row-hover`. Koyu tema: `dark:` varyantı (`data-theme="dark"`).

## Bileşenler
| Bileşen | API |
|---|---|
| `Page` | `{children}` — max 1600px, px-4/sm:px-6, dikey boşluk |
| `PageHeader` | `{title, meta?, actions?}` |
| `Tabs<K>` | `{items:{key,label}[], value, onChange}` — alt çizgili, mobilde yatay kayar |
| `KpiStrip` | `{items: {label, value, sub?}[]}` — mobil 2 sütun |
| `Section` | `{title, count?, actions?, children}` |
| `Toolbar` / `Field` | tek satır filtre; `Field {label}` yan etiket |
| `FilterGrid` / `StackField` | çok filtre ızgarası (1→2→4→6 sütun), `footer?`; `StackField {label}` üst etiket |
| `Button` | `{variant:'primary'\|'secondary'\|'ghost', size:'sm'\|'md', ...button}` |
| `Input`, `Select` | native props |
| `Checkbox` | `{label, ...input}`; `Range` native props |
| `Badge` | `{tone:'neutral'\|'accent'\|'ok'\|'warn'\|'danger'}` — yalnız çerçeve |
| `Notice` | `{tone?:'danger'\|'warn'\|'ok'}` — sol çizgili bant |
| `Drawer` / `Modal` | `{open, onClose, side?:'left'\|'right'\|'center', title?}` — Esc + arka plan kapatır |
| `DataTable<T>` | `{rows, columns: Column<T>[], title?, csvName?, loading?, emptyText?, tall?, footer?, sortable?}` |
| `Column<T>` | `{key, label, value(r), render?(r), num?, cellClass?(r)}` |
| yardımcılar | `cn`, `downloadCsv`, özel tablo için `th`, `td`, `numCls` |

## Örnek
```tsx
<Page>
  <PageHeader title="Yönetim Özeti" actions={<Button size="sm" variant="secondary">Yenile</Button>} />
  <KpiStrip items={[{ label: 'Portföy', value: 25 }]} />
  <FilterGrid><StackField label="Arama"><Input /></StackField></FilterGrid>
  <DataTable rows={rows} columns={cols} csvName="rapor" />
</Page>
```

## Yeni ekran taşıma
1. Ekran CSS importunu ve `<style>`/inline stilleri kaldır, yukarıdaki bileşenlere geç.
2. Rotayı `components/PanelShell.tsx` → `DS_ROUTES` listesine ekle (eski `.pax-main` kuralları devre dışı kalır).
3. CSS dosyası başka yerde kullanılmıyorsa sil.
4. `npx tsc --noEmit`, `npm run build`, 5 breakpoint ekran görüntüsü.
