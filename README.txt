Bu paket tam kaynak kodun yerine geçmez.
Elindeki dosya kaynak repo değil, .next build çıktısıydı.
Bu yüzden yalnızca güvenle yeniden yazılabilen ve Supabase auth kırılımını çözen dosyaları hazırladım.

Uygulama sırası:
1) Aşağıdaki dosyaları kendi proje köküne aynı yollarla kopyala.
2) package.json içinde pg ve bcryptjs yoksa kur:
   npm install pg bcryptjs
   npm install -D @types/pg @types/bcryptjs
3) .env.local içine şunları ekle:
   DATABASE_URL=postgresql://postgres:SIFRE@localhost:5432/crm_local
   AUTH_COOKIE_NAME=crm_session
   AUTH_SESSION_TTL_HOURS=24
4) db/001_auth_tables.sql çalıştır.
5) Bir kullanıcı üretmek için db/002_seed_example.sql içindeki yönergeyi uygula.
6) allowed_users tablonu mevcut yapına göre doldur.
7) npm run dev ile başlat.

Önemli:
- Bu paket auth/session tarafını local PostgreSQL'e geçirir.
- CRM veri route'larında hala Supabase .from(...).select(...) çağrıları varsa onlar ayrıca pg sorgularına çevrilmelidir.
- lib/supabase/server.ts ve admin.ts dosyaları bilinçli olarak hata fırlatır; kalan Supabase bağımlı route'ları kolay tespit et diye.
