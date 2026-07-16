# CRM Performans / Page İyileştirme V15

## Yapılanlar

- Aktivite listesinde `q`, `owner`, `responsible` filtreleri artık mümkün olduğunca DB tarafında daraltılıyor.
- Aktivite listesi, bu filtrelerde artık gereksiz şekilde 5000 kayıt çekip uygulama katmanında süzme davranışına düşmüyor.
- İş ortağı/müşteri adı araması için önce ilgili müşteri ID havuzu bulunup aktivite sorgusuna uygulanıyor.
- SLA filtresi özel tarih/durum hesabı gerektirdiği için uygulama katmanında bırakıldı.
- Aktivite dashboard analitik çağrısı liste çağrısından kısa süre sonra ertelendi; ilk tablo daha hızlı görünür.
- Müşteri listesinde genel arama DB tarafında daraltıldı; sadece künye/kasa gibi hesaplanmış alanlarda toplu çekim korunuyor.
- SQL dosyası eklenmedi.

## Beklenen Etki

- Aktivite ekranında filtreli arama ve sorumlu bazlı liste daha hızlı döner.
- Müşteri listesinde arama yaparken tüm müşteri havuzunu çekme ihtiyacı azalır.
- Page/pageSize davranışı daha gerçek server-side pagination mantığına yaklaşır.

## Not

- Künye durumu ve kasa firması gibi view dışı/zenginleştirilmiş alanlar halen uygulama katmanında hesaplandığı için bu filtrelerde toplu veri okuma korunmuştur.
- Daha ileri hız için DB view içine künye/kasa alanları eklenip indekslenebilir.
