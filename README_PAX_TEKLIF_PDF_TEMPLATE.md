# PAX teklif PDF template entegrasyonu

Bu pakette teklif PDF üretimi artık HTML/print sayfası üzerinden değil, doğrudan `public/templates/pax-teklif-template.pdf` dosyasını şablon olarak açıp içine veri basarak çalışır.

Eklenenler:

- `app/api/quotes/[quoteId]/pdf/route.ts`
- `public/templates/pax-teklif-template.pdf`
- `package.json` ve `package-lock.json` içine `pdf-lib` / `@pdf-lib/fontkit`
- `components/quotes/QuoteDetailClient.tsx` içerisindeki buton `/api/quotes/{id}/pdf` adresine çevrildi.

Sunucuda çalıştır:

```bash
npm install
npm run build
pm2 restart <uygulama-adi>
```

Türkçe karakterler için route önce `public/fonts/DejaVuSans.ttf`, sonra sistem fontlarını arar. Font dosyası pakete bilinçli olarak eklenmedi. Sunucuda genelde `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` vardır. Yoksa şu paket yeterlidir:

```bash
sudo apt-get update
sudo apt-get install -y fonts-dejavu-core
```
