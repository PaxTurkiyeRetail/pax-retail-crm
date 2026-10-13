-- 20261013_042_tv_devices.sql
-- TV CİHAZ EŞLEŞTİRME (13.10.2026)
--
-- Toplantı odasındaki Android TV (Chrome) kullanıcı girişi olmadan Canlı Ekran'ı gösterir.
-- Akış: TV /tv açar → sunucu cihaz token'ı üretir (cookie crm_tv, yalnız hash burada) + 6 haneli kod.
-- Admin "TV Cihazları" ekranında kodu girip cihazı onaylar → cihaz yalnız Canlı Ekran verisini okur.
-- İptal: revoked_at doldurulur (satır silinmez).
--
-- Dosya idempotenttir. Veri silmez.

create table if not exists public.tv_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  token_hash text not null,
  pair_code text,
  pair_code_expires_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  revoked_at timestamptz,
  revoked_by text,
  last_seen_at timestamptz,
  last_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint tv_devices_token_hash_key unique (token_hash)
);

create index if not exists tv_devices_pair_code_idx on public.tv_devices (pair_code) where pair_code is not null;
