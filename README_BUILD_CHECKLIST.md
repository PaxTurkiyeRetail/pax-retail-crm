# PAX Retail CRM – Build Safety Checklist

## 1) Client / Server Component Kontrolü
- `useState`, `useEffect`, event handler veya browser API kullanıyorsan dosyanın en üstünde `"use client";` var mı?
- Server component içinde `styled-jsx`, `window`, `document` veya client-only import kullanılıyor mu?
- Client component, server component içine props ile güvenli şekilde geçiyor mu?

## 2) Route Kontrolü
- `app/.../page.tsx` doğru klasörde mi?
- Dynamic route dosyaları (`[id]`) doğru dizinde mi?
- Menüden erişilen tüm route’lar gerçekten mevcut mu?

## 3) Import ve Alias Kontrolü
- `@/components/...` ve relative path’ler doğru mu?
- Taşınan dosyaların import yolları güncellendi mi?
- Kullanılmayan import’lar temizlendi mi?

## 4) Mock / Gerçek Veri Geçişi
- DB henüz bağlı değilse fallback veri var mı?
- `undefined` veya `null` durumda sayfa kırılıyor mu?
- Empty state ve loading state gösteriliyor mu?

## 5) Stamp Sistemi Kontrolü
- DB veya otomasyon bekleyen sayfalarda `SystemRequirementStamp` var mı?
- Drawer içindeki yapılacaklar listesi güncel mi?
- Yeni modül açıldıysa `lib/system-requirements.ts` içine işlendi mi?

## 6) Faz Modülü Kontrolü
- 1–25 alt faz → 5 ana faz mapping doğru mu?
- Aktif faz doğru gruba düşüyor mu?
- Faz geçmişi DB yokken boş durum kartı ile yönetiliyor mu?

## 7) Teklif Modülü Kontrolü
- Ürün kataloğu açılıyor mu?
- Fiyat baremleri düzgün listeleniyor mu?
- Teklif oluştur ve portföy ekranı boş durumda da çalışıyor mu?

## 8) UI Dayanıklılığı
- Kartlar farklı metin uzunluklarında patlıyor mu?
- Mobil / tablet / desktop görünüm kontrol edildi mi?
- Scroll, taşma ve hizalama sorunları temiz mi?

## 9) Build Öncesi Teknik Kontrol
- `npm run lint` temiz mi?
- `npm run check:build` çıktı verdi mi?
- `npm run build` hatasız tamamlandı mı?

## 10) Deploy Öncesi Son Kontrol
- Kritik ekranlar tek tek açıldı mı?
- Console error var mı?
- Menü, detay sayfaları ve yeni modüller çalışıyor mu?

---

Bu dosya her build ve teslimat öncesi hızlı kontrol için kullanılmalıdır.


## 11. Müşteri Segmentasyonu Kontrolü
- Firma Durumu badge görünüyor mu?
- Yönetim Tipi badge görünüyor mu?
- phase fallback notu görünür mü?
- rehber sayfası açılıyor mu?
- system tracker içinde customerList / customerGuide kayıtları var mı?

## 11. Customer Segmentation Override
- Firma detayında Firma Durumu ve Yönetim Tipi dropdown görünür mü?
- Manuel seçim sonrası override etiketi geliyor mu?
- "Sistem önerisine dön" butonu override temizliyor mu?
- Backend henüz bağlı değilken local demo hafızası çalışıyor mu?
