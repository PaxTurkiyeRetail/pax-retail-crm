-- 20260909_025_musteri_listesi_hflk.sql
-- MÜŞTERİ LİSTESİ (H/F/L/K) — Çağdaş Bey'in kişi bazlı firma dağılım listesi CRM'e taşındı
-- (Sinan, 09.09.2026). Kaynak: "CRM Müşteriler Dosyası" Excel'i (tek sayfa; kolon başlıkları
-- "FURKAN H", "ÖMER F", "CEM L", "ÖMER K" … biçiminde).
--
-- KARARLAR (Sinan, 09.09):
--   * Kısaltmalar: H = Hunter · F = Farmer · L = Lead · K = Kasa Firması → 4 ayrı tablo.
--   * Herkes görür (Raporlar › Müşteri Listesi); yalnız Admin ve Super Admin düzenler
--     (yeni yetki: customer.assignment_list.manage). Düzenleme ekrandan: sürükle-bırak /
--     "Taşı" ile firma doğru kişiye-kategoriye aktarılır, ekle / yeniden adlandır / kaldır.
--   * "ERDİ" kolonunun kategorisi yoktu → şimdilik HEPSİ Hunter (Erdi/Farmer vb. ekrandan taşınır).
--   * Excel'de iki "ÖMER K" kolonu vardı → tek listede birleştirildi (6 + 9 = 15 firma).
--   * Firma olmayan hücreler alınmadı: "10 tane", "3 tane", "2 tane" (H kolonlarının altındaki
--     notlar) ve "B" (ÖMER K).
--   * Firma adları Excel'deki gibi bırakıldı (yalnız baş/son boşluk ve çift boşluk temizlendi);
--     büyük/küçük harf düzeltmesi ekrandan yapılabilir. Aynı hücrede mükerrer yoktu.
--   * Kişi anahtarı görünen ad (satici) — Canlı Ekran'ın OWNER_ORDER'ı ile aynı yazım;
--     owner_user_id allowed_users'tan ada göre çözülür (bulunamazsa NULL kalır, ekran ada göre
--     çalışır; ekrandan kişi seçilince ikisi birlikte yazılır).
--   * Kaldırma = pasife alma (is_active=false), fiziksel silme yok; her değişiklik crm_audit_events'e düşer.
--
-- Canlı Ekran kişi slaytındaki H/F donut'u bu tablodan beslenir (künye satici_etiketi değil).
-- Dosya idempotenttir; tekrar çalıştırılması güvenlidir (seed satırları "yoksa ekle").

-- ---------------------------------------------------------------------------
-- 1) Tablo
-- ---------------------------------------------------------------------------
create table if not exists public.crm_musteri_listesi (
  id uuid primary key default gen_random_uuid(),
  -- H = Hunter · F = Farmer · L = Lead · K = Kasa Firması
  kategori text not null,
  -- Görünen ad (allowed_users.full_name ile aynı yazım; Canlı Ekran OWNER_ORDER)
  satici text not null,
  owner_user_id uuid references public.allowed_users(id) on delete set null,
  firma text not null,
  -- İleride CRM müşteri kartına bağlamak için (bugün boş)
  musteri_id uuid references public.musteriler(id) on delete set null,
  sira integer not null default 0,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint crm_musteri_listesi_kategori_check check (kategori in ('H', 'F', 'L', 'K')),
  constraint crm_musteri_listesi_firma_check check (length(trim(firma)) between 1 and 160)
);

-- Aynı kişi + kategori altında aynı firma (büyük/küçük harf duyarsız) bir kez.
create unique index if not exists crm_musteri_listesi_uniq_active
  on public.crm_musteri_listesi (kategori, lower(satici), lower(trim(firma)))
  where is_active;
create index if not exists idx_crm_musteri_listesi_satici on public.crm_musteri_listesi (lower(satici)) where is_active;
create index if not exists idx_crm_musteri_listesi_owner on public.crm_musteri_listesi (owner_user_id) where is_active;

comment on table public.crm_musteri_listesi is
  'Müşteri Listesi (H/F/L/K): satış yönetiminin kişi bazlı firma dağılımı. Kaynak Excel 09.09.2026''da yüklendi; sonrası yalnız ekrandan (Raporlar › Müşteri Listesi) düzenlenir. Canlı Ekran kişi slaytı H/F donut''u buradan okur.';
comment on column public.crm_musteri_listesi.kategori is 'H = Hunter · F = Farmer · L = Lead · K = Kasa Firması';
comment on column public.crm_musteri_listesi.satici is 'Görünen ad; allowed_users.full_name ile aynı yazım (Canlı Ekran OWNER_ORDER).';

-- ---------------------------------------------------------------------------
-- 2) Yetki: düzenleme yalnız admin + super_admin (görüntüleme mevcut
--    report.read.all + screen.reports.view ile — Raporlar menüsündeki diğer ekranlar gibi)
-- ---------------------------------------------------------------------------
insert into public.rbac_permissions(permission_key, module_key, label, description)
values
  ('customer.assignment_list.manage', 'customer', 'Müşteri Listesi (H/F/L/K) düzenleme',
   'Raporlar › Müşteri Listesi ekranında firma ekleme, taşıma (kişi/kategori), yeniden adlandırma ve kaldırma. Görüntüleme herkeste; düzenleme Admin ve Super Admin.')
on conflict (permission_key) do update
  set module_key = excluded.module_key, label = excluded.label, description = excluded.description;

insert into public.rbac_role_permissions(role_key, permission_key, granted)
select r.role_key, 'customer.assignment_list.manage', true
from (values ('admin'), ('super_admin')) r(role_key)
where exists (select 1 from public.rbac_roles rr where rr.role_key = r.role_key and rr.is_active = true)
  and exists (select 1 from public.rbac_permissions p where p.permission_key = 'customer.assignment_list.manage')
on conflict (role_key, permission_key) do update
  set granted = true, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Excel'in yüklenmesi (155 firma) — yoksa ekle; var olana dokunma
-- ---------------------------------------------------------------------------
with seed(satici, kategori, firma, sira) as (
values
-- Cem Koç · Hunter (6 firma)
  ('Cem Koç', 'H', 'BOYNER', 10),
  ('Cem Koç', 'H', 'KARACA ZÜCCACİYE', 20),
  ('Cem Koç', 'H', 'FLO', 30),
  ('Cem Koç', 'H', 'A101 -CARFOUER', 40),
  ('Cem Koç', 'H', 'SHAYA', 50),
  ('Cem Koç', 'H', 'YURTİÇİ KARGO', 60),

-- Cem Koç · Farmer (2 firma)
  ('Cem Koç', 'F', 'UNIFREE DUTY FREE', 10),
  ('Cem Koç', 'F', 'BEYMEN', 20),

-- Cem Koç · Lead (16 firma)
  ('Cem Koç', 'L', 'Bahaus', 10),
  ('Cem Koç', 'L', 'EREN HOLDİNG', 20),
  ('Cem Koç', 'L', 'Gratis', 30),
  ('Cem Koç', 'L', 'KOÇTAŞ', 40),
  ('Cem Koç', 'L', 'Madame Coco', 50),
  ('Cem Koç', 'L', 'MAVİ JEANS', 60),
  ('Cem Koç', 'L', 'MİGROS', 70),
  ('Cem Koç', 'L', 'MR DIY', 80),
  ('Cem Koç', 'L', 'PENTİ', 90),
  ('Cem Koç', 'L', 'ÖZDİLEK', 100),
  ('Cem Koç', 'L', 'ROSMANN', 110),
  ('Cem Koç', 'L', 'Sürat Kargo', 120),
  ('Cem Koç', 'L', 'Şok Marketler', 130),
  ('Cem Koç', 'L', 'Tuborg', 140),
  ('Cem Koç', 'L', 'Uludağ', 150),
  ('Cem Koç', 'L', 'MEY DİEGO', 160),

-- Cem Koç · Kasa Firması (3 firma)
  ('Cem Koç', 'K', 'robotpos', 10),
  ('Cem Koç', 'K', 'Adisyo', 20),
  ('Cem Koç', 'K', 'logo', 30),

-- Ömer Canatar · Hunter (9 firma)
  ('Ömer Canatar', 'H', 'ÇETİNKAYA', 10),
  ('Ömer Canatar', 'H', 'E-BEBEK', 20),
  ('Ömer Canatar', 'H', 'ETİ', 30),
  ('Ömer Canatar', 'H', 'NIKE SPORTINN', 40),
  ('Ömer Canatar', 'H', 'NUREDERM KOZMETİK', 50),
  ('Ömer Canatar', 'H', 'SEYHANLAR MARKET', 60),
  ('Ömer Canatar', 'H', 'TESPO', 70),
  ('Ömer Canatar', 'H', 'TOYPA', 80),
  ('Ömer Canatar', 'H', 'ÜLKER', 90),

-- Ömer Canatar · Farmer (3 firma)
  ('Ömer Canatar', 'F', 'BİZİM TOPTAN', 10),
  ('Ömer Canatar', 'F', 'LULEMON', 20),
  ('Ömer Canatar', 'F', 'M&S - GAP', 30),

-- Ömer Canatar · Lead (9 firma)
  ('Ömer Canatar', 'L', 'KOTON', 10),
  ('Ömer Canatar', 'L', 'COLİNS', 20),
  ('Ömer Canatar', 'L', 'İKEA', 30),
  ('Ömer Canatar', 'L', 'DECATHLON', 40),
  ('Ömer Canatar', 'L', 'Mudo', 50),
  ('Ömer Canatar', 'L', 'WATSONS', 60),
  ('Ömer Canatar', 'L', 'TEKNOSA', 70),
  ('Ömer Canatar', 'L', 'Peynirci BABA', 80),
  ('Ömer Canatar', 'L', 'Sephora', 90),

-- Ömer Canatar · Kasa Firması (15 firma)
  ('Ömer Canatar', 'K', 'omnipos', 10),
  ('Ömer Canatar', 'K', 'posback', 20),
  ('Ömer Canatar', 'K', 'ADAMPOS', 30),
  ('Ömer Canatar', 'K', 'enpos', 40),
  ('Ömer Canatar', 'K', 'Barsoft', 50),
  ('Ömer Canatar', 'K', 'toshiba', 60),
  ('Ömer Canatar', 'K', 'DOJOFOOD', 70),
  ('Ömer Canatar', 'K', 'BEREKET DÖNER', 80),
  ('Ömer Canatar', 'K', 'KOMAGENE', 90),
  ('Ömer Canatar', 'K', '312 POS', 100),
  ('Ömer Canatar', 'K', 'Akınsoft', 110),
  ('Ömer Canatar', 'K', 'Atiker', 120),
  ('Ömer Canatar', 'K', 'Çamlıca Barkod', 130),
  ('Ömer Canatar', 'K', 'Eray elektronik', 140),
  ('Ömer Canatar', 'K', 'Kalem', 150),

-- Furkan Kızılkurt · Hunter (26 firma)
  ('Furkan Kızılkurt', 'H', 'ADİL IŞIK', 10),
  ('Furkan Kızılkurt', 'H', 'AKER', 20),
  ('Furkan Kızılkurt', 'H', 'BROOKS BROTHER', 30),
  ('Furkan Kızılkurt', 'H', 'COLUMBİA', 40),
  ('Furkan Kızılkurt', 'H', 'ÇİÇEK RETAIL GROUP', 50),
  ('Furkan Kızılkurt', 'H', 'DAMAT TWEEN', 60),
  ('Furkan Kızılkurt', 'H', 'GALATASARAY MAĞAZACILIK', 70),
  ('Furkan Kızılkurt', 'H', 'GREYDER', 80),
  ('Furkan Kızılkurt', 'H', 'GUSTO', 90),
  ('Furkan Kızılkurt', 'H', 'HEMINGTON', 100),
  ('Furkan Kızılkurt', 'H', 'JACK & JONES', 110),
  ('Furkan Kızılkurt', 'H', 'KNITSS', 120),
  ('Furkan Kızılkurt', 'H', 'LUFİAN', 130),
  ('Furkan Kızılkurt', 'H', 'NOCTURNE', 140),
  ('Furkan Kızılkurt', 'H', 'PANÇO', 150),
  ('Furkan Kızılkurt', 'H', 'RAMSEY', 160),
  ('Furkan Kızılkurt', 'H', 'SKECHERS', 170),
  ('Furkan Kızılkurt', 'H', 'SNEAKS UP', 180),
  ('Furkan Kızılkurt', 'H', 'SO CHIC', 190),
  ('Furkan Kızılkurt', 'H', 'SPX', 200),
  ('Furkan Kızılkurt', 'H', 'SÜVARİ', 210),
  ('Furkan Kızılkurt', 'H', 'TERGAN', 220),
  ('Furkan Kızılkurt', 'H', 'TWIGY', 230),
  ('Furkan Kızılkurt', 'H', 'YVES ROCHER', 240),
  ('Furkan Kızılkurt', 'H', 'PUMA', 250),
  ('Furkan Kızılkurt', 'H', 'Lociante', 260),

-- Furkan Kızılkurt · Farmer (16 firma)
  ('Furkan Kızılkurt', 'F', 'ALTINYILDIZ', 10),
  ('Furkan Kızılkurt', 'F', 'BG STORE', 20),
  ('Furkan Kızılkurt', 'F', 'ÇİFT GEYİK KARACA', 30),
  ('Furkan Kızılkurt', 'F', 'DAGİ', 40),
  ('Furkan Kızılkurt', 'F', 'EKOL GİYİM', 50),
  ('Furkan Kızılkurt', 'F', 'EVKUR', 60),
  ('Furkan Kızılkurt', 'F', 'İPEKYOL', 70),
  ('Furkan Kızılkurt', 'F', 'KİĞILI', 80),
  ('Furkan Kızılkurt', 'F', 'MAD PARFUM', 90),
  ('Furkan Kızılkurt', 'F', 'PSL - GALLERY CRYSTAL', 100),
  ('Furkan Kızılkurt', 'F', 'SCHAFER', 110),
  ('Furkan Kızılkurt', 'F', 'SEVİL PARFÜMERİ', 120),
  ('Furkan Kızılkurt', 'F', 'SUWEN', 130),
  ('Furkan Kızılkurt', 'F', 'YARGICI', 140),
  ('Furkan Kızılkurt', 'F', 'LEE COOPER', 150),
  ('Furkan Kızılkurt', 'F', 'MARKAPARK', 160),

-- Furkan Kızılkurt · Lead (6 firma)
  ('Furkan Kızılkurt', 'L', 'Bella Maison', 10),
  ('Furkan Kızılkurt', 'L', 'Rebul', 20),
  ('Furkan Kızılkurt', 'L', 'ZSA ZSA ZSU', 30),
  ('Furkan Kızılkurt', 'L', 'Saat & saat', 40),
  ('Furkan Kızılkurt', 'L', 'Talipsan', 50),
  ('Furkan Kızılkurt', 'L', 'Tudors', 60),

-- Furkan Kızılkurt · Kasa Firması (2 firma)
  ('Furkan Kızılkurt', 'K', 'GİZSOFT', 10),
  ('Furkan Kızılkurt', 'K', 'Nebim', 20),

-- Erdi Toraman · Hunter (42 firma)
  ('Erdi Toraman', 'H', 'ACIBADEM', 10),
  ('Erdi Toraman', 'H', 'AKSU GÖZTEPE HASTANESİ', 20),
  ('Erdi Toraman', 'H', 'AKTİF İNTERNATİONAL', 30),
  ('Erdi Toraman', 'H', 'AMERİKAN HASTANESİ', 40),
  ('Erdi Toraman', 'H', 'AVİCENNA HASTANESİ', 50),
  ('Erdi Toraman', 'H', 'AVRASYA HOSPİTAL', 60),
  ('Erdi Toraman', 'H', 'BHT CLINIC & TEMA HASTANESİ', 70),
  ('Erdi Toraman', 'H', 'BİLMED', 80),
  ('Erdi Toraman', 'H', 'BİRİNCİ SAĞLIK', 90),
  ('Erdi Toraman', 'H', 'DENTGROUP CLINICS', 100),
  ('Erdi Toraman', 'H', 'DENTSPA', 110),
  ('Erdi Toraman', 'H', 'DÜNYAGÖZ', 120),
  ('Erdi Toraman', 'H', 'EMSEY HOSPİTAL', 130),
  ('Erdi Toraman', 'H', 'ERDEM SAĞLIK GRUBU', 140),
  ('Erdi Toraman', 'H', 'ERSOY SAĞLIK GRUBU', 150),
  ('Erdi Toraman', 'H', 'ESTEWORLD PLASTİK CERRAHİ SAĞLIK GRUBU', 160),
  ('Erdi Toraman', 'H', 'FLORENCE NİGHTİNGALE', 170),
  ('Erdi Toraman', 'H', 'FSM TIP MERKEZİ', 180),
  ('Erdi Toraman', 'H', 'HİSAR HOSPİTAL', 190),
  ('Erdi Toraman', 'H', 'HOSPİTADENT', 200),
  ('Erdi Toraman', 'H', 'İRMET HOSPİTAL', 210),
  ('Erdi Toraman', 'H', 'KARMED/KARDELEN YAZILIM', 220),
  ('Erdi Toraman', 'H', 'KOÇ ÜNİVERSİTE HASTANESİ', 230),
  ('Erdi Toraman', 'H', 'KOLAN HOSPİTAL', 240),
  ('Erdi Toraman', 'H', 'KOLAY GELSİN', 250),
  ('Erdi Toraman', 'H', 'LİV HOSPİTAL', 260),
  ('Erdi Toraman', 'H', 'LOKMAN HEKİM HASTANESİ', 270),
  ('Erdi Toraman', 'H', 'MAYADENT', 280),
  ('Erdi Toraman', 'H', 'MEDISTATE', 290),
  ('Erdi Toraman', 'H', 'MEDİCANA', 300),
  ('Erdi Toraman', 'H', 'MEDİPOL', 310),
  ('Erdi Toraman', 'H', 'MEMORİAL', 320),
  ('Erdi Toraman', 'H', 'NP İSTANBUL HASTANESİ', 330),
  ('Erdi Toraman', 'H', 'OPTİMED HOSPİTAL', 340),
  ('Erdi Toraman', 'H', 'ÖZEL PENDİK BÖLGE HASTANESİ', 350),
  ('Erdi Toraman', 'H', 'ÖZEL SANCAKTEPE BÖLGE HASTANESİ', 360),
  ('Erdi Toraman', 'H', 'PROBEL YAZILIM', 370),
  ('Erdi Toraman', 'H', 'TEMA HASTANESİ', 380),
  ('Erdi Toraman', 'H', 'VENI VIDI GÖZ', 390),
  ('Erdi Toraman', 'H', 'YAŞAM HASTANESİ', 400),
  ('Erdi Toraman', 'H', 'YEDİTEPE ÜNİVERSİTE HASTANESİ', 410),
  ('Erdi Toraman', 'H', 'ZÜBER', 420)
),
owner_lookup as (
  -- Adı seed ile birebir aynı ya da aynı ilk adla başlayan aktif kullanıcı (ilk eşleşme).
  select distinct on (s.satici) s.satici, u.id as owner_user_id
  from (select distinct satici from seed) s
  join public.allowed_users u
    on u.is_active = true
   and (
     lower(trim(u.full_name)) = lower(s.satici)
     or (
       -- İlk ada göre yalnız account_manager'lar arasında (aynı ilk adlı başka kullanıcıya bağlanmasın)
       (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))
       and upper(trim(u.full_name)) like upper(split_part(s.satici, ' ', 1)) || ' %'
     )
   )
  order by s.satici, (lower(trim(u.full_name)) = lower(s.satici)) desc, u.created_at
)
insert into public.crm_musteri_listesi (kategori, satici, owner_user_id, firma, sira, created_by, updated_by)
select s.kategori, s.satici, ol.owner_user_id, s.firma, s.sira, 'migration:20260909_025', 'migration:20260909_025'
from seed s
left join owner_lookup ol on ol.satici = s.satici
where not exists (
  select 1 from public.crm_musteri_listesi e
  where e.kategori = s.kategori
    and lower(e.satici) = lower(s.satici)
    and lower(trim(e.firma)) = lower(trim(s.firma))
    and e.is_active
);

-- Daha önce ada göre çözülememiş satırlar için owner_user_id'yi tamamla (kullanıcı sonradan açıldıysa).
update public.crm_musteri_listesi l
set owner_user_id = u.id
from public.allowed_users u
where l.owner_user_id is null
  and u.is_active = true
  and lower(trim(u.full_name)) = lower(l.satici);
