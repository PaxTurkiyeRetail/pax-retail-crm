-- 20260910_028_satis_pivot_ice_aktarim.sql
-- GERÇEK SATIŞ GEÇMİŞİNİN İÇE AKTARIMI — Furkan'ın "PAX Retail Satış Pivot Listesi 10.09.2026"
-- dosyası (Sinan, 10.09.2026: "mockup veri değil bu Excel, bunları direkt gömebilirsen göm").
--
-- İÇERİK: 131 satır · 27.01.2025 – 03.09.2026 · 44 firma · 2.893 cihaz ·
--         2025 $228.625 + 2026 $334.010. Kanallar: DİREKT SATIŞ (75) ve PARAMTECH (56).
--
-- KARARLAR (Sinan, 10.09):
--   * 2025 ve 2026'nın tamamı yüklenir (2026 satırları Canlı Ekran YTD cirosuna girer).
--   * Satışçı = firmanın CRM'deki sorumlusu; sorumlusu yoksa 'Havuz Account'.
--   * CRM'de KARŞILIĞI OLMAYAN firma için müşteri kaydı AÇILMAZ. O satırlar bekleme
--     tablosunda (`crm_sales_import_pivot`, customer_id NULL) durur, ciroya girmez;
--     eşleşmeyenlerin listesi Sinan'a bildirilir, elle eşlendikten sonra 4. adımdaki
--     komut tekrar çalıştırılarak aktarılır.
--   * Tutar Excel'den gelir (katalog hesabı yapılmaz) → `price_source='manual'`.
--     Satış tipi 'sale', para birimi USD, kayıt aktif; `source='direct'` (teklifsiz).
--
-- İDEMPOTENT: kaynak satırların kimliği `import_key`; tekrar çalıştırma ne mükerrer satır
-- ne mükerrer satış üretir (aktarılan satırda `sale_id` dolu olur, tekrar aktarılmaz).
--
-- UYARI: aynı satış CRM'de kazanılmış bir teklifden de gelmiş olabilir — bu dosya kontrol
-- edemez. Deploy sonrası Satışlar ekranında 2026 kayıtlarına göz atılmalı (mükerrer varsa
-- iptal edilir, silinmez).

-- ---------------------------------------------------------------------------
-- 1) Kanal listesine PARAMTECH eklenir (Forecast ile ortak liste — tek kaynak)
-- ---------------------------------------------------------------------------
insert into public.system_parameters (group_key, param_key, label, value, sort_order)
values ('forecast_sales_channel', 'paramtech', 'Paramtech', 'Paramtech', 40)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2) Bekleme (staging) tablosu + kaynak satırlar
-- ---------------------------------------------------------------------------
create table if not exists public.crm_sales_import_pivot (
  id uuid primary key default gen_random_uuid(),
  import_key text not null unique,
  sales_channel text not null,
  sale_date date not null,
  firma text not null,
  device_count integer not null check (device_count >= 0),
  amount numeric not null check (amount >= 0),
  unit_price numeric,
  models text not null,
  customer_id uuid references public.musteriler(id) on delete set null,
  sale_id uuid references public.crm_sales(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.crm_sales_import_pivot is
  'Furkan''ın 10.09.2026 satış pivot Excel''i: kaynak satırlar. customer_id NULL = CRM''de firma bulunamadı (satış yazılmadı); sale_id dolu = crm_sales''e aktarıldı.';

insert into public.crm_sales_import_pivot (import_key, sales_channel, sale_date, firma, device_count, amount, unit_price, models)
values
  ('pivot-10.09.2026-001', 'Direkt Satis', date '2025-01-27', 'UNIFREE', 5, 1275.00, 255.00, 'A920PRO × 5'),
  ('pivot-10.09.2026-002', 'Direkt Satis', date '2025-02-06', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 2, 550.00, 275.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-003', 'Direkt Satis', date '2025-02-06', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 2, 550.00, 275.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-004', 'Direkt Satis', date '2025-02-11', 'UNIFREE', 2, 510.00, 255.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-005', 'Direkt Satis', date '2025-02-13', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 1, 275.00, 275.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-006', 'Direkt Satis', date '2025-02-25', 'UNIFREE', 7, 1785.00, 255.00, 'A920PRO × 7'),
  ('pivot-10.09.2026-007', 'Direkt Satis', date '2025-03-20', 'UNIFREE', 3, 765.00, 255.00, 'A920PRO × 3'),
  ('pivot-10.09.2026-008', 'Direkt Satis', date '2025-04-02', 'UNIFREE', 4, 1020.00, 255.00, 'A920PRO × 4'),
  ('pivot-10.09.2026-009', 'Direkt Satis', date '2025-04-24', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 2, 550.00, 275.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-010', 'Direkt Satis', date '2025-04-24', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 2, 550.00, 275.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-011', 'Paramtech', date '2025-04-24', 'MISSHA', 1, 187.00, 187.00, 'A80 × 1'),
  ('pivot-10.09.2026-012', 'Paramtech', date '2025-04-25', 'SCHAFER', 26, 13182.00, 507.00, 'A6650 × 26'),
  ('pivot-10.09.2026-013', 'Direkt Satis', date '2025-05-06', 'EVKUR', 201, 39999.00, 199.00, 'A80 × 201'),
  ('pivot-10.09.2026-014', 'Direkt Satis', date '2025-05-07', 'BEYMEN', 7, 3500.00, 500.00, 'A6650 × 7'),
  ('pivot-10.09.2026-015', 'Direkt Satis', date '2025-05-13', 'BEYMEN', 6, 3000.00, 500.00, 'A6650 × 6'),
  ('pivot-10.09.2026-016', 'Direkt Satis', date '2025-05-13', 'BEYMEN', 6, 3000.00, 500.00, 'A6650 × 6'),
  ('pivot-10.09.2026-017', 'Direkt Satis', date '2025-05-13', 'BEYMEN', 7, 3500.00, 500.00, 'A6650 × 7'),
  ('pivot-10.09.2026-018', 'Direkt Satis', date '2025-05-27', 'E-KASA', 11, 6193.00, 563.00, 'A6650 × 11'),
  ('pivot-10.09.2026-019', 'Paramtech', date '2025-06-12', 'SINIRLI SORUMLU KOOPERATİF', 1, 187.00, 187.00, 'A80 × 1'),
  ('pivot-10.09.2026-020', 'Paramtech', date '2025-06-17', 'MISSHA', 16, 2992.00, 187.00, 'A80 × 16'),
  ('pivot-10.09.2026-021', 'Paramtech', date '2025-06-23', 'PARAMTECH STOK', 1, 61.50, 61.50, 'S210 × 1'),
  ('pivot-10.09.2026-022', 'Paramtech', date '2025-06-23', 'PARAMTECH STOK', 3, 184.50, 61.50, 'S210 × 3'),
  ('pivot-10.09.2026-023', 'Direkt Satis', date '2025-06-26', 'BEYMEN', 11, 5500.00, 500.00, 'A6650 × 11'),
  ('pivot-10.09.2026-024', 'Direkt Satis', date '2025-06-26', 'BEYMEN', 9, 4500.00, 500.00, 'A6650 × 9'),
  ('pivot-10.09.2026-025', 'Paramtech', date '2025-07-03', 'MISSHA', 2, 336.00, 168.00, 'A80 × 2'),
  ('pivot-10.09.2026-026', 'Paramtech', date '2025-07-03', 'ÇİFT GEYİK KARACA', 7, 1176.00, 168.00, 'A80 × 7'),
  ('pivot-10.09.2026-027', 'Paramtech', date '2025-07-03', 'BGSTORE', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-028', 'Paramtech', date '2025-07-03', 'JACK & JONES', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-029', 'Paramtech', date '2025-07-03', 'ÇAK TEKSTİL', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-030', 'Paramtech', date '2025-07-03', 'TALİPSAN', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-031', 'Paramtech', date '2025-07-03', 'HUMMEL', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-032', 'Paramtech', date '2025-07-03', 'İPEKYOL', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-033', 'Paramtech', date '2025-07-03', 'MADAME COCO', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-034', 'Paramtech', date '2025-07-03', 'YOLPARAM', 1, 250.00, 250.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-035', 'Paramtech', date '2025-07-03', 'YOLPARAM', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-036', 'Paramtech', date '2025-07-03', 'TURK ELEKTRONİK PARA A.Ş.', 1, 250.00, 250.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-037', 'Paramtech', date '2025-07-03', 'TURK ELEKTRONİK PARA A.Ş.', 1, 168.00, 168.00, 'A80 × 1'),
  ('pivot-10.09.2026-038', 'Paramtech', date '2025-07-03', 'PARAMTECH STOK', 1, 211.00, 211.00, 'A77 × 1'),
  ('pivot-10.09.2026-039', 'Paramtech', date '2025-07-03', 'PARAMTECH STOK', 1, 250.00, 250.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-040', 'Paramtech', date '2025-07-03', 'PARAMTECH STOK', 8, 1344.00, 168.00, 'A80 × 8'),
  ('pivot-10.09.2026-041', 'Paramtech', date '2025-07-08', 'HİTA CONCEPT', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-042', 'Direkt Satis', date '2025-07-30', 'YARGICI', 26, 16484.00, 634.00, 'A6650 × 26'),
  ('pivot-10.09.2026-043', 'Direkt Satis', date '2025-07-30', 'YARGICI', 26, 5486.00, 211.00, 'A80 × 26'),
  ('pivot-10.09.2026-044', 'Direkt Satis', date '2025-07-30', 'UNIFREE', 1, 255.00, 255.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-045', 'Paramtech', date '2025-08-05', 'SCHAFER', 26, 13182.00, 507.00, 'A6650 × 26'),
  ('pivot-10.09.2026-046', 'Direkt Satis', date '2025-08-12', 'BEYMEN', 3, 1500.00, 500.00, 'A6650 × 3'),
  ('pivot-10.09.2026-047', 'Paramtech', date '2025-08-21', 'SCHAFER', 3, 1521.00, 507.00, 'A6650 × 3'),
  ('pivot-10.09.2026-048', 'Direkt Satis', date '2025-08-27', 'BEYMEN', 2, 490.00, 245.00, 'A77 × 2'),
  ('pivot-10.09.2026-049', 'Paramtech', date '2025-09-16', 'GALLERY CRYSTAL', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-050', 'Paramtech', date '2025-09-16', 'JACK & JONES', 1, 507.00, 507.00, 'A6650 × 1'),
  ('pivot-10.09.2026-051', 'Paramtech', date '2025-09-16', 'SENNA DİZAYN', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-052', 'Paramtech', date '2025-09-16', 'NEBİM', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-053', 'Paramtech', date '2025-09-29', 'ÇİFT GEYİK KARACA', 10, 1870.00, 187.00, 'A80 × 10'),
  ('pivot-10.09.2026-054', 'Paramtech', date '2025-09-29', 'JACK & JONES', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-055', 'Paramtech', date '2025-10-14', 'ÇİFT GEYİK KARACA', 4, 748.00, 187.00, 'A80 × 4'),
  ('pivot-10.09.2026-056', 'Paramtech', date '2025-10-14', 'MARKA PARK', 3, 1689.00, 563.00, 'A6650 × 3'),
  ('pivot-10.09.2026-057', 'Direkt Satis', date '2025-10-27', 'UNIFREE', 33, 9273.00, 281.00, 'A920PRO × 33'),
  ('pivot-10.09.2026-058', 'Paramtech', date '2025-10-31', 'GALLERY CRYSTAL', 50, 25350.00, 507.00, 'A6650 × 50'),
  ('pivot-10.09.2026-059', 'Paramtech', date '2025-10-31', 'SEVİL PARFÜMERİ', 21, 3528.00, 168.00, 'A80 × 21'),
  ('pivot-10.09.2026-060', 'Paramtech', date '2025-10-31', 'TURK ELEKTRONİK PARA A.Ş.', 21, 3528.00, 168.00, 'A80 × 21'),
  ('pivot-10.09.2026-061', 'Paramtech', date '2025-12-04', 'MISSHA', 6, 1122.00, 187.00, 'A80 × 6'),
  ('pivot-10.09.2026-062', 'Paramtech', date '2025-12-04', 'GALLERY CRYSTAL', 49, 24843.00, 507.00, 'A6650 × 49'),
  ('pivot-10.09.2026-063', 'Paramtech', date '2025-12-04', 'ÇİFT GEYİK KARACA', 52, 8736.00, 168.00, 'A80 × 52'),
  ('pivot-10.09.2026-064', 'Paramtech', date '2025-12-04', 'MARKA PARK', 20, 3740.00, 187.00, 'A80 × 20'),
  ('pivot-10.09.2026-065', 'Paramtech', date '2025-12-05', 'SKECHERS', 1, 187.00, 187.00, 'A80 × 1'),
  ('pivot-10.09.2026-066', 'Paramtech', date '2025-12-10', 'JACK & JONES', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-067', 'Paramtech', date '2025-12-10', 'JACK & JONES', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-068', 'Paramtech', date '2025-12-24', 'MARKA PARK', 2, 1126.00, 563.00, 'A6650 × 2'),
  ('pivot-10.09.2026-069', 'Paramtech', date '2025-12-29', 'BGSTORE', 2, 374.00, 187.00, 'A80 × 2'),
  ('pivot-10.09.2026-070', 'Direkt Satis', date '2026-01-15', 'KIĞILI', 500, 93500.00, 187.00, 'A80 × 500'),
  ('pivot-10.09.2026-071', 'Paramtech', date '2026-01-28', 'COLUMBİA', 3, 561.00, 187.00, 'A80 × 3'),
  ('pivot-10.09.2026-072', 'Direkt Satis', date '2026-02-16', 'BEYMEN', 8, 4000.00, 500.00, 'A6650 × 8'),
  ('pivot-10.09.2026-073', 'Direkt Satis', date '2026-02-16', 'BEYMEN', 7, 3500.00, 500.00, 'A6650 × 7'),
  ('pivot-10.09.2026-074', 'Direkt Satis', date '2026-02-16', 'BEYMEN', 7, 3500.00, 500.00, 'A6650 × 7'),
  ('pivot-10.09.2026-075', 'Direkt Satis', date '2026-02-16', 'BEYMEN', 9, 4500.00, 500.00, 'A6650 × 9'),
  ('pivot-10.09.2026-076', 'Direkt Satis', date '2026-02-16', 'BEYMEN', 7, 770.00, 110.00, 'A6650 × 7'),
  ('pivot-10.09.2026-077', 'Direkt Satis', date '2026-02-19', 'YARGICI', 26, 1599.00, 61.50, 'S210 × 26'),
  ('pivot-10.09.2026-078', 'Paramtech', date '2026-02-24', 'SNEAKS UP', 1, 187.00, 187.00, 'A80 × 1'),
  ('pivot-10.09.2026-079', 'Direkt Satis', date '2026-02-25', 'YARGICI', 26, 4862.00, 187.00, 'A80 × 26'),
  ('pivot-10.09.2026-080', 'Paramtech', date '2026-02-25', 'ALTINYILDIZ', 1, 187.00, 187.00, 'A80 × 1'),
  ('pivot-10.09.2026-081', 'Paramtech', date '2026-03-31', 'MISSHA', 13, 2431.00, 187.00, 'A80 × 13'),
  ('pivot-10.09.2026-082', 'Paramtech', date '2026-04-06', 'PARAMTECH STOK', 15, 8445.00, 563.00, 'A6650 × 15'),
  ('pivot-10.09.2026-083', 'Paramtech', date '2026-04-06', 'PARAMTECH STOK', 15, 2520.00, 168.00, 'A80 × 15'),
  ('pivot-10.09.2026-084', 'Direkt Satis', date '2026-04-13', 'BEYMEN', 50, 25000.00, 500.00, 'A6650 × 50'),
  ('pivot-10.09.2026-085', 'Direkt Satis', date '2026-04-13', 'BEYMEN', 3, 1500.00, 500.00, 'A6650 × 3'),
  ('pivot-10.09.2026-086', 'Direkt Satis', date '2026-04-13', 'BEYMEN', 6, 3000.00, 500.00, 'A6650 × 6'),
  ('pivot-10.09.2026-087', 'Direkt Satis', date '2026-04-13', 'BEYMEN', 3, 1500.00, 500.00, 'A6650 × 3'),
  ('pivot-10.09.2026-088', 'Direkt Satis', date '2026-04-14', 'ZYB TEKNOLOJİ ANONİM ŞİRKETİ', 1, 312.00, 312.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-089', 'Direkt Satis', date '2026-04-16', 'SUWEN', 36, 2772.00, 77.00, 'S210 × 36'),
  ('pivot-10.09.2026-090', 'Direkt Satis', date '2026-04-16', 'SUWEN', 36, 7596.00, 211.00, 'A80 × 36'),
  ('pivot-10.09.2026-091', 'Direkt Satis', date '2026-04-16', 'BEYMEN', 25, 12500.00, 500.00, 'A6650 × 25'),
  ('pivot-10.09.2026-092', 'Direkt Satis', date '2026-04-17', 'BEYMEN', 26, 13000.00, 500.00, 'A6650 × 26'),
  ('pivot-10.09.2026-093', 'Direkt Satis', date '2026-04-17', 'BEYMEN', 8, 4000.00, 500.00, 'A6650 × 8'),
  ('pivot-10.09.2026-094', 'Direkt Satis', date '2026-04-22', 'METIS YAZILIM', 7, 4928.00, 704.00, 'A6650 × 7'),
  ('pivot-10.09.2026-095', 'Direkt Satis', date '2026-04-22', 'SUWEN', 50, 10550.00, 211.00, 'A80 × 50'),
  ('pivot-10.09.2026-096', 'Direkt Satis', date '2026-04-22', 'SUWEN', 50, 3850.00, 77.00, 'S210 × 50'),
  ('pivot-10.09.2026-097', 'Direkt Satis', date '2026-04-29', 'YARGICI', 41, 8651.00, 211.00, 'A80 × 41'),
  ('pivot-10.09.2026-098', 'Direkt Satis', date '2026-04-29', 'YARGICI', 41, 3157.00, 77.00, 'S210 × 41'),
  ('pivot-10.09.2026-099', 'Direkt Satis', date '2026-04-29', 'YARGICI', 25, 1925.00, 77.00, 'S210 × 25'),
  ('pivot-10.09.2026-100', 'Paramtech', date '2026-04-29', 'BGSTORE', 30, 1845.00, 61.50, 'S210 × 30'),
  ('pivot-10.09.2026-101', 'Paramtech', date '2026-04-29', 'BGSTORE', 30, 5610.00, 187.00, 'A80 × 30'),
  ('pivot-10.09.2026-102', 'Paramtech', date '2026-04-30', 'NARAMAXX', 6, 369.00, 61.50, 'S210 × 6'),
  ('pivot-10.09.2026-103', 'Paramtech', date '2026-04-30', 'NARAMAXX', 40, 6720.00, 168.00, 'A80 × 40'),
  ('pivot-10.09.2026-104', 'Paramtech', date '2026-04-30', 'ÖZŞANAL ZÜCCACİYE', 33, 5544.00, 168.00, 'A80 × 33'),
  ('pivot-10.09.2026-105', 'Direkt Satis', date '2026-05-14', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 2, 490.00, 245.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-106', 'Direkt Satis', date '2026-05-20', 'VERIMSOFT', 3, 231.00, 77.00, 'S210 × 3'),
  ('pivot-10.09.2026-107', 'Direkt Satis', date '2026-06-19', 'DAGİ', 15, 6.08, 405.00, 'A6630 × 15'),
  ('pivot-10.09.2026-108', 'Direkt Satis', date '2026-06-26', 'LEE COOPER', 26, 7202.00, 211.00, 'A80 × 26'),
  ('pivot-10.09.2026-109', 'Direkt Satis', date '2026-06-26', 'LEE COOPER', 26, 2.00, 77.00, 'S210 × 26'),
  ('pivot-10.09.2026-110', 'Direkt Satis', date '2026-06-26', 'ÇİFT GEYİK KARACA', 26, 5486.00, 211.00, 'A80 × 26'),
  ('pivot-10.09.2026-111', 'Direkt Satis', date '2026-06-29', 'MAD PARFÜM', 255, 50.74, 199.00, 'A80 × 255'),
  ('pivot-10.09.2026-112', 'Direkt Satis', date '2026-06-29', 'MAD PARFÜM', 255, 19.64, 77.00, 'S210 × 255'),
  ('pivot-10.09.2026-113', 'Direkt Satis', date '2026-07-22', 'SCHAFER', 3, 1902.00, 634.00, 'A6650 × 3'),
  ('pivot-10.09.2026-114', 'Direkt Satis', date '2026-07-29', 'SUWEN', 134, 26666.00, 199.00, 'A80 × 134'),
  ('pivot-10.09.2026-115', 'Direkt Satis', date '2026-07-29', 'SUWEN', 134, 10318.00, 77.00, 'S210 × 134'),
  ('pivot-10.09.2026-116', 'Direkt Satis', date '2026-08-04', 'MARKA MAĞAZACILIK (FIBA RETAIL)', 2, 550.00, 275.00, 'A920PRO × 2'),
  ('pivot-10.09.2026-117', 'Direkt Satis', date '2026-08-04', 'MARKA PARK', 3, 2112.00, 704.00, 'A6650 × 3'),
  ('pivot-10.09.2026-118', 'Direkt Satis', date '2026-08-06', 'BEYMEN', 6, 3000.00, 500.00, 'A6650 × 6'),
  ('pivot-10.09.2026-119', 'Direkt Satis', date '2026-08-06', 'BEYMEN', 6, 3000.00, 500.00, 'A6650 × 6'),
  ('pivot-10.09.2026-120', 'Direkt Satis', date '2026-08-06', 'BEYMEN', 6, 3000.00, 500.00, 'A6650 × 6'),
  ('pivot-10.09.2026-121', 'Direkt Satis', date '2026-08-26', 'BEYMEN', 15, 7500.00, 500.00, 'A6650 × 15'),
  ('pivot-10.09.2026-122', 'Direkt Satis', date '2026-08-28', 'YARGICI', 27, 2079.00, 77.00, 'S210 × 27'),
  ('pivot-10.09.2026-123', 'Direkt Satis', date '2026-08-28', 'YARGICI', 11, 2321.00, 211.00, 'A80 × 11'),
  ('pivot-10.09.2026-124', 'Direkt Satis', date '2026-08-28', 'ÇİÇEK İÇ GİYİM', 3, 702.00, 234.00, 'A80 × 3'),
  ('pivot-10.09.2026-125', 'Direkt Satis', date '2026-08-28', 'ÇİÇEK İÇ GİYİM', 3, 231.00, 77.00, 'S210 × 3'),
  ('pivot-10.09.2026-126', 'Direkt Satis', date '2026-08-31', 'NEXİVOX', 1, 167.00, 167.00, 'A910S × 1'),
  ('pivot-10.09.2026-127', 'Direkt Satis', date '2026-08-31', 'DAS BİLGİSAYAR', 1, 250.00, 250.00, 'A920PRO × 1'),
  ('pivot-10.09.2026-128', 'Direkt Satis', date '2026-09-01', 'PAKKOD', 1, 563.00, 563.00, 'A6650 × 1'),
  ('pivot-10.09.2026-129', 'Direkt Satis', date '2026-09-01', 'PAKKOD', 1, 167.00, 167.00, 'A910S × 1'),
  ('pivot-10.09.2026-130', 'Direkt Satis', date '2026-09-03', 'SUWEN', 4, 796.00, 199.00, 'A80 × 4'),
  ('pivot-10.09.2026-131', 'Direkt Satis', date '2026-09-03', 'SUWEN', 4, 308.00, 77.00, 'S210 × 4')
on conflict (import_key) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Firma eşleştirme (Türkçe karakter ve noktalama duyarsız, birebir ad)
-- ---------------------------------------------------------------------------
with norm as (
  select p.id as import_id,
         regexp_replace(upper(translate(p.firma, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as key
  from public.crm_sales_import_pivot p
  where p.customer_id is null
),
customers as (
  select m.id,
         regexp_replace(upper(translate(m.musteri, 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')), '[^A-Z0-9]', '', 'g') as key
  from public.musteriler m
),
tek as (
  -- yalnız TEK adayı olan anahtarlar eşleşir (aynı ada iki kayıt varsa elle karar verilir)
  select key, (array_agg(id order by id))[1] as customer_id
  from customers
  group by key
  having count(*) = 1
)
update public.crm_sales_import_pivot p
set customer_id = tek.customer_id
from norm
join tek on tek.key = norm.key
where p.id = norm.import_id;

-- ---------------------------------------------------------------------------
-- 4) Eşleşen satırlardan satış kaydı (teklifsiz, tutar Excel'den)
--    Bu blok tek başına da çalıştırılabilir: elle eşleme sonrası tekrar koşturun.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_owner text;
  v_owner_id uuid;
  v_sale uuid;
  v_count int := 0;
begin
  for r in
    select p.*, m.musteri, nullif(trim(m.sorumlu), '') as sorumlu
    from public.crm_sales_import_pivot p
    join public.musteriler m on m.id = p.customer_id
    where p.sale_id is null
    order by p.sale_date, p.import_key
  loop
    v_owner := coalesce(r.sorumlu, 'Havuz Account');
    select u.id into v_owner_id
    from public.allowed_users u
    where u.is_active = true
      and lower(coalesce(nullif(trim(u.full_name), ''), u.email)) = lower(v_owner)
    limit 1;

    insert into public.crm_sales (
      quote_id, quote_no, source, customer_id, owner_name, owner_user_id,
      sale_date, device_count, amount, hardware_amount, sale_type,
      rental_monthly_amount, currency, price_source, status, sales_channel, note,
      created_by, updated_by
    ) values (
      null, null, 'direct', r.customer_id, v_owner, v_owner_id::text,
      r.sale_date, r.device_count, r.amount, r.amount, 'sale',
      0, 'USD', 'manual', 'active', r.sales_channel, r.models || ' · kaynak: Satış Pivot Listesi 10.09.2026',
      'import:satis-pivot-10.09.2026', 'import:satis-pivot-10.09.2026'
    )
    returning id into v_sale;

    update public.crm_sales_import_pivot set sale_id = v_sale where id = r.id;
    v_count := v_count + 1;
  end loop;

  raise notice 'Satış pivot içe aktarımı: % satış kaydı oluşturuldu.', v_count;
  raise notice 'Eşleşmeyen (müşterisi bulunamayan) satır: %',
    (select count(*) from public.crm_sales_import_pivot where customer_id is null);
  raise notice 'Eşleşmeyen firmalar: %',
    coalesce((select string_agg(firma, ', ' order by firma) from (select distinct firma from public.crm_sales_import_pivot where customer_id is null) t), 'yok');
end $$;
