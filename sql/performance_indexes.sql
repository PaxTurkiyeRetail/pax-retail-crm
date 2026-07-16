-- PAX CRM performans indeksleri
-- Guvenli calisir: IF NOT EXISTS nedeniyle tekrar uygulanabilir.

-- Auth / oturum
create index if not exists idx_allowed_users_email_lower on public.allowed_users (lower(email));
create index if not exists idx_user_sessions_token_expires on public.user_sessions (session_token, expires_at desc);
create index if not exists idx_user_sessions_user_expires on public.user_sessions (user_id, expires_at desc);

-- Musteriler / pipeline liste filtreleri
create index if not exists idx_musteriler_sorumlu on public.musteriler (sorumlu);
create index if not exists idx_musteriler_sektor on public.musteriler (sektor);
create index if not exists idx_musteriler_entegrasyon on public.musteriler (entegrasyon_tipi);
create index if not exists idx_musteriler_sorumlu_sektor on public.musteriler (sorumlu, sektor);
create index if not exists idx_musteriler_sektor_enteg on public.musteriler (sektor, entegrasyon_tipi);
create index if not exists idx_musteriler_musteri_lower on public.musteriler (lower(musteri));

create index if not exists idx_musteri_pipeline_musteri on public.musteri_pipeline (musteri_id);
create index if not exists idx_musteri_pipeline_faz on public.musteri_pipeline (aktif_faz_no, updated_at desc);
create index if not exists idx_musteri_pipeline_owner on public.musteri_pipeline (owner);

-- Aktivite / timeline / SLA filtreleri
create index if not exists idx_pipeline_eventleri_musteri_created on public.pipeline_eventleri (musteri_id, created_at desc);
create index if not exists idx_pipeline_eventleri_musteri_faz_created on public.pipeline_eventleri (musteri_id, faz_no, created_at desc);
create index if not exists idx_pipeline_eventleri_created_at on public.pipeline_eventleri (created_at desc);
create index if not exists idx_pipeline_eventleri_created_by_created on public.pipeline_eventleri (created_by, created_at desc);
create index if not exists idx_pipeline_eventleri_owner_created on public.pipeline_eventleri (owner, created_at desc);
create index if not exists idx_pipeline_eventleri_durum_hedef on public.pipeline_eventleri (durum, hedef_tarihi);
create index if not exists idx_pipeline_eventleri_partner_owner on public.pipeline_eventleri (partner_owner);
create index if not exists idx_pipeline_eventleri_faz_durum_created on public.pipeline_eventleri (faz_no, durum, created_at desc);
create index if not exists idx_pipeline_eventleri_hedef_created on public.pipeline_eventleri (hedef_tarihi, created_at desc);

-- Kunya / rapor joinleri
create index if not exists idx_musteri_kunye_v2_musteri on public.musteri_kunye_v2 (musteri_id);

-- Teklif modulu
create index if not exists idx_quotes_created_at on public.quotes (created_at desc);
create index if not exists idx_quotes_status_created on public.quotes (status, created_at desc);
create index if not exists idx_quotes_owner_created on public.quotes (owner_name, created_at desc);
create index if not exists idx_quotes_customer_created on public.quotes (customer_id, created_at desc);
create index if not exists idx_quote_items_quote_line on public.quote_items (quote_id, line_no);

-- Talep / operasyon modulu
create index if not exists idx_requests_created_at on public.requests (created_at desc);
create index if not exists idx_requests_status_created on public.requests (status, created_at desc);
create index if not exists idx_requests_priority_created on public.requests (priority, created_at desc);
create index if not exists idx_requests_sla_created on public.requests (sla_status, created_at desc);
create index if not exists idx_requests_assignee_created on public.requests (assignee_id, created_at desc);
create index if not exists idx_requests_requester_created on public.requests (requester_id, created_at desc);
