Bu paket Supabase auth bağımlılığını PostgreSQL tabanlı local auth katmanına çevirir.

Özet:
- allowed_users tablosu kullanıcı kaynağı olarak kullanılır.
- password_hash kolonu bcrypt hash saklar.
- user_sessions tablosu cookie session saklar.
- password_reset_tokens tablosu şifre sıfırlama tokenlarını saklar.
- lib/supabase/* dosyaları artık PostgreSQL üstünde çalışan bir uyumluluk katmanıdır.

Yapılacaklar:
1) npm install
2) db/001_auth_tables.sql çalıştır
3) gerekli admin kullanıcıları db/002_seed_example.sql veya admin panel ile oluştur
4) .env.local içine DATABASE_URL, AUTH_COOKIE_NAME, AUTH_SESSION_TTL_HOURS ekle
5) npm run dev

Şifre sıfırlama:
- /forgot-password sayfasında email gir
- geliştirme ortamında reset linki ekranda görünür ve server loguna yazılır
- /reset-password?token=... ile yeni şifre verilir

Not:
- Veri erişimi için route'lar hâlâ Supabase benzeri zincir çağrıları kullanıyor olabilir; bunlar artık lib/supabase/pg-client.ts içindeki PostgreSQL uyumluluk katmanına yönlenir.
- Daha karmaşık PostgREST özellikleri gerekiyorsa ilgili route özel SQL ile ayrıca iyileştirilmelidir.
