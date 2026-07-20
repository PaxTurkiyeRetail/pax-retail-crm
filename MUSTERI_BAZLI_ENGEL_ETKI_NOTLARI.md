# Müşteri Bazlı Engel & Etki — Değişiklik Özeti

- Liste kaynağı aktif Forecast satırlarından tüm satış müşterilerine çevrildi.
- Normal kullanıcı kapsamı `musteriler.sorumlu` üzerinden belirleniyor.
- Admin ve super admin tüm müşteri kapsamına ve yönetim raporlarına sahip.
- Kayıt anahtarı `forecast_id` yerine `customer_id` oldu.
- Forecast bağlantısı yalnız bütçe kayması için zorunlu.
- Müşteri birden fazla aktif Forecast'a sahipse formdan etkilenen Forecast seçiliyor.
- Aylık bütçe raporu tüm aktif Forecast toplamlarını kullanıyor.
- API sahiplik kontrolleri liste, upsert, resolve ve reopen işlemlerinde tekrar uygulanıyor.
