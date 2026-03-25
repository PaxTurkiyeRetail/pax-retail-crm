-- once bcrypt hash'i üretin ve aşağıya yapıştırın
-- node
-- const bcrypt = require('bcryptjs'); bcrypt.hash('pax9876@@', 10).then(console.log)

insert into public.allowed_users (email, full_name, role, is_active)
values ('taha.bitim@paxturkiye.com', 'Taha Bitim', 'admin', true)
on conflict (email) do nothing;

update public.allowed_users
set password_hash = 'BURAYA_BCRYPT_HASH'
where lower(email) = lower('taha.bitim@paxturkiye.com');
