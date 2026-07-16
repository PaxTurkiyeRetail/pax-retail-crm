# Kurumsal Analiz ve Performans Notları

## Güncel durum

- API cache kapalı tutulur; kayıt sonrası eski veri görünme riski azaltıldı.
- Parametre merkezi CRM ayar ekranı gibi kurgulandı.
- SQL klasöründeki eski çalışma dosyaları temizlendi; canlıda çalıştırılacak yeni SQL dosyası bırakılmadı.
- Parametre ve iş ortağı faz yapısı uygulama tarafından güvenli `if not exists` kontrolleriyle hazırlanır.

## Son pakette güçlendirilen alanlar

- İş ortağı aktiviteleri rapor/presentation akışına dahil edildi.
- İş ortağına özel faz yönetimi eklendi.
- Normal müşteri faz tanımları parametre ekranında yönetilebilir hale getirildi.
- Satışçı sunumunda Jira/Retail Support slaytı tamamen kaldırıldı; boş sayfa kalmaması hedeflendi.
- Satışçı seçeneğinde Seda Kesikoğlu ve Cem Koç görünür tutuldu.

## Kontrol listesi

1. Parametreler ekranında Faz Yönetimi · İş Ortakları altında en az bir faz tanımı oluştur.
2. İş ortağı seçip account aktivitesi gir; faz listesinin iş ortağı fazlarından geldiğini kontrol et.
3. Teknik Online/Teknik Ziyaret/POM ile aynı iş ortağında fazın değişmediğini kontrol et.
4. Haftalık aktiviteler ve satışçı sunumunda iş ortağı aktivitelerinin geldiğini kontrol et.
5. Satışçı sunumu PPTX içinde Jira/Retail Support boş slaytı kalmadığını kontrol et.
