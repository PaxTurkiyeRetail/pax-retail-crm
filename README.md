# Supabase CRM Panel (Allowlist + Admin)

## Kurulum
1) `.env` oluştur:
```bash
cp .env.example .env
```

2) Paketleri kur:
```bash
npm i
```

3) Çalıştır:
```bash
npm run dev
```

## Özet
- `/login` -> email+şifre giriş (önce allowlist kontrolü)
- `/crm` -> korumalı
- `/admin/users` -> admin korumalı
- Admin panel kullanıcı ekler/siler/pasife çeker (service role ile Auth + allowed_users)

> NOT: `SUPABASE_SERVICE_ROLE_KEY` sadece server tarafında kullanılır.


## Şifremi Unuttum
- `/login` ekranındaki "Şifremi unuttum" linki `/forgot-password` sayfasını açar.
- Supabase Dashboard → Authentication → URL Configuration:
  - Site URL: `http://localhost:3000`
  - Redirect URL: `http://localhost:3000/auth/callback`


## CRM Yetkilendirme
- CRM liste verisi `vw_crm_musteriler` view'ünden gelir.
- Admin: tüm kayıtları görür.
- User: `sorumlu` alanı kendi **Ad Soyad** (allowed_users.full_name) ile eşleşen kayıtları görür.

## CRM Raporlar
- `/crm/reports` ekranı faz ve risk bazlı toplamlara bakar.

## Aktiviteler + Sonraki Aktivite Planı
- `/crm/activities/new`: satışçı günlük aktivite girer.
  - Müşteri seçince mevcut faz otomatik dolar (isterse faz değiştirir).
  - Opsiyonel olarak "Sonraki aktivite" planı girer (tarih + hedef aksiyon + bekleyen taraf).
- `/crm/activities`: bekleyen planların listesi (plan_status='open').
  - Admin tüm planları görür.
  - User sadece kendi planlarını görür.

### DB (zorunlu)
Aktivite planları için `pipeline_eventleri` tablosuna plan alanlarını ekle:

```sql
-- sql/plan_columns.sql
```


## CRM: Filtre + Yeni Müşteri
- `/crm` ekranında arama + risk/faz/durum filtreleri vardır.
- Sağ üstteki `+` ile yeni müşteri eklenir.
  - Admin: sorumlu seçebilir.
  - User: sorumlu otomatik kendi email’idir.
- Kayıt `musteriler` tablosuna insert atar (bkz. DB açıklaması: musteriler alanları). 
