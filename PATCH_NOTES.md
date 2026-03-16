# Patch Notes

Bu pakette iki konu ele alındı:

## 1) Dashboard güncellemesi
- Faz isimleri şu şekilde değiştirildi:
  - Lead
  - İlk Temas
  - Ticari
  - Operasyon
  - Yayılım
- Ekranın altındaki tekrar eden faz kartlarının kaldırılması için dashboard üst bölüm tek faz kaynağı olarak kurgulandı.
- Hover taşmaları kaldırıldı, kart içi açılır liste mantığı kullanıldı.
- Renkler daha kurumsal ve birbirine yakın tona çekildi.

## 2) Console error: absoluteStrokeWidth
Gönderdiğin hata ekranı dashboard'dan değil, `components/PanelShell.tsx` içindeki lucide icon kullanımından geliyor.

Aşağıdaki gibi bir kullanım varsa:
```tsx
<SomeIcon absoluteStrokeWidth className="..." />
```

bunu şu şekilde düzelt:
```tsx
<SomeIcon className="..." strokeWidth={1.75} />
```

veya sadece:
```tsx
<SomeIcon className="..." />
```

Özet:
- `absoluteStrokeWidth` DOM'a düşüyor ve React uyarı veriyor.
- Bu fix `CrmDashboardClient.tsx` içinde değil, `PanelShell.tsx` içinde yapılmalı.
