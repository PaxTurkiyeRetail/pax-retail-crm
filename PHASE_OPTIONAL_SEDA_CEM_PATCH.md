# Seda Kesikoğlu / Cem Koç teknik aktivite faz opsiyonel patch

Bu patch aşağıdaki iki dosyada uygulanmıştır:

- `app/api/activities/create/route.ts`
- `components/activities/QuickActivityClient.tsx`

Mantık:

- Aktivite tipi `Teknik Ziyaret` veya `Teknik Online` ise teknik aktivitedir.
- Seçilen müşterinin `sorumlu` alanı `Seda Kesikoğlu` veya `Cem Koç` ise faz bilgisi zorunlu değildir.
- Bu özel sorumlularda kayıt `faz_no = null`, `activity_scope = technical`, `affects_phase = false` olarak girilebilir.
- Backend artık bu müşterilerde faz yok diye `Bu müşteri için faz bilgisi bulunamadı...` hatası dönmez.
- Normal teknik müşterilerde eski kural korunur: faz snapshot yoksa hata döner.
- Account aktivitelerinde eski kural korunur: faz zorunludur.
