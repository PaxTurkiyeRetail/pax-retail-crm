# Engel & Etki - Client Bundle Build Duzeltmesi

## Sorun
`components/blocker-impact/BlockerImpactClient.tsx` bir Client Component olmasina ragmen `lib/forecast.ts` dosyasini import ediyordu.
`lib/forecast.ts -> lib/system-parameters.ts -> lib/db.ts -> pg` zinciri nedeniyle Webpack tarayici bundle'inda Node.js modullerini (`fs`, `dns`, `net`, `tls`) cozmeye calisiyordu.

## Duzeltme
- `lib/forecast-shared.ts` eklendi.
- Browser ve server tarafinda ortak kullanilabilen saf forecast sabitleri/yardimcilari bu dosyaya tasindi.
- `BlockerImpactClient.tsx` ve `lib/forecast-blockers.ts`, `lib/forecast-shared.ts` kullanacak sekilde degistirildi.
- `lib/forecast.ts`, ortak dosyayi re-export ediyor; DB kullanan fonksiyonlar server dosyasinda kalmaya devam ediyor.
- `lib/forecast-blocker-access.ts` saf yetki yardimcilari icin ortak dosyaya baglandi.

## Kontroller
- `npm run typecheck`: BASARILI
- `npm run lint`: 0 hata; projede mevcut 109 uyari
- `npm run check:build`: BASARILI
- `npm run qa:crm`: tamamlandi; mevcut bilgilendirme/uyarilar raporlandi
- `next build`: Webpack compile asamasi BASARILI (`Compiled successfully`); onceki Node.js modul hatalari yok
