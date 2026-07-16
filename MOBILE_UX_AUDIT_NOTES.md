# Mobile UX ve Global Feedback Düzeltmeleri

Bu pakette mevcut iş akışları bozulmadan aşağıdaki altyapı güçlendirmeleri yapıldı:

- Global toast sistemi daha gelişmiş hale getirildi.
- Tüm internal API kaydetme/güncelleme/silme işlemlerinde loading, success ve error bildirimi sağlandı.
- PPTX, PDF, Excel, CSV ve rapor indirme isteklerinde indirme süreci görünür hale getirildi.
- API hatası, bağlantı hatası, beklenmeyen Promise hatası ve sayfa runtime hatası kullanıcıya gösterilir hale getirildi.
- Offline/online durumları için sağ alt bildirim eklendi.
- Mobilde buton, input ve select dokunma alanları güçlendirildi.
- Mobilde input font-size 16px yapılarak iOS otomatik zoom azaltıldı.
- Tablolar mobilde yatay kaydırılabilir hale getirildi ve kullanıcıya kaydırma ipucu gösterildi.
- Mobil toast kutuları safe-area destekli tam genişliğe yakın konumlandırıldı.
- Sayfa render hataları için kullanıcı dostu tekrar dene / sayfayı yenile fallback ekranı eklendi.

Ana dosyalar:
- components/AppToaster.tsx
- components/AppRuntimeBoundary.tsx
- components/AppRuntimeShell.tsx
- app/layout.tsx
- app/globals.css
