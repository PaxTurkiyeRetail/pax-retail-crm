# Parametre Yönetimi Güncellemesi

Bu paket müşteri künye seçim listelerini, sistem ayarlarını ve faz yönetimini uygulama içindeki Parametreler ekranına taşır.

## Güncel yapı

- Künye dropdown değerleri `public.system_parameters` üzerinden yönetilir.
- Normal müşteri fazları `public.faz_tanimlari` üzerinden yönetilir.
- İş ortağı fazları `public.is_ortagi_faz_tanimlari` üzerinden yönetilir.
- İş ortağı faz tablosu uygulama tarafından güvenli şekilde `create table if not exists` mantığıyla hazırlanır.
- SQL klasöründe çalıştırılacak eski migration/seed dosyası bırakılmadı.

## Ekran

Parametre ekranı sadece teknik sahiplerde görünür:

- Taha Bitim
- Ömer Canatar

Yapı:

- Sistem Ayarları
- Entegrasyonlar
- Liste Yönetimleri
  - Müşteri Künye alt kırılımları
  - Faz Yönetimi · Müşteri Pipeline
  - Faz Yönetimi · İş Ortakları
- Güvenlik ve Tanı

## İşleyiş

- Liste parametreleri eklenebilir, düzenlenebilir, pasife alınabilir ve silinebilir.
- Faz tanımlarında faz no, faz adı ve owner yönetilir.
- İş ortakları account aktivitelerinde kendi faz listesini kullanır.
- Teknik Online, Teknik Ziyaret ve POM faz değiştirmez.
- İş ortağında faz yoksa teknik aktivitede kullanıcıya Account ekibine haber verme uyarısı gösterilir.
