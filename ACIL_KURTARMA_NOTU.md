# Acil CRM Kurtarma Paketi

Bu paket, müşteri ekranını bozan son UI ve genel PG adapter müdahalelerini geri alır.
Mevcut çalışan tasarım korunur. Yalnızca `vw_crm_musteriler` okumaları sunucu
katmanında, güvenli ve dar kapsamlı bir müşteri ana tablo kaynağına yönlendirilir.

Değişen tek çalışma dosyası:

- `lib/pg/client.ts`

Engel & Etki modülü ve history nullable düzeltmesi pakette korunmuştur.
Yeni SQL migration gerekmez.
