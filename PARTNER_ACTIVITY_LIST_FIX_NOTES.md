# İş Ortağı Aktivite Listesi Düzeltmeleri

## Kapsam
- İş ortakları aktivitelerinde faz tooltip/ad çözümlemesi artık müşteri faz tablosundan değil `is_ortagi_faz_tanimlari` tablosundan yapılır.
- Aktivite listesi API'si her satır için `is_business_partner`, `phase_title`, `phase_owner` ve normalize edilmiş `partner_owner` alanlarını döndürür.
- `partner_owner` boşsa iş ortağı faz tanımındaki `owner` bilgisi bekleyen taraf olarak gösterilir.
- Müşteri aktivitelerinde mevcut `faz_tanimlari` davranışı korunur.
- SQL klasörüne yeni dosya eklenmedi.

## Etkilenen Dosyalar
- `app/api/activities/list/route.ts`
- `app/(panel)/crm/activities/page.tsx`
