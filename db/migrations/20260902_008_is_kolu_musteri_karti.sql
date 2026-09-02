-- 20260902_008_is_kolu_musteri_karti.sql
-- İş Kolu tek kavram olur ve müşteri kartına taşınır (Sinan kararı, 02.09.2026):
--   * musteriler.is_kolu yeni otorite alandır (Retail / Vertical / Bank).
--   * "Bank" değeri kunye_is_kolu parametre grubuna eklenir.
--   * Banka / Vertical / İŞ ORTAĞI artık SEKTÖR DEĞİL: sektör kataloğundan
--     pasife çekilir, bu sektörlerdeki müşterilerin sektörü boşaltılır.
--   * VERİ KORUMA: boşaltılan sektör değeri musteriler.sektor_onceki kolonunda
--     birebir saklanır — hiçbir değer silinmez, sahipleri gerçek sektörü
--     seçtiğinde eski değer yine bu kolonda durur.
--   * Künye ekranı İş Kolu'nu artık müşteri kartından okur (view güncellenir);
--     musteri_kunye_v2.is_kolu kolonu geriye dönük uyum için yerinde bırakılır
--     ama yazılmaz/okunmaz.
--
-- Dosya idempotenttir; tekrar çalıştırılması güvenlidir.

-- 1) Yeni kolonlar
alter table public.musteriler add column if not exists is_kolu text;
alter table public.musteriler add column if not exists sektor_onceki text;

-- 2) Parametre: Bank değeri + grup başlığı zaten "İş Kolu"
insert into public.system_parameters (group_key, param_key, label, value, sort_order, meta)
values
  ('kunye_is_kolu', 'bank', 'Bank', 'Bank', 30, '{"source":"manual","module":"CRM","category":"Künye"}'::jsonb)
on conflict (group_key, param_key) do update
  set label = excluded.label, value = excluded.value, sort_order = excluded.sort_order,
      meta = excluded.meta, is_active = true, updated_at = now();

-- 3) İş Kolu geri doldurma (öncelik sırası: künyedeki mevcut değer → sektörden türetme → Retail)
update public.musteriler m
set is_kolu = k.is_kolu
from public.musteri_kunye_v2 k
where k.musteri_id = m.id
  and m.is_kolu is null
  and k.is_kolu is not null;

update public.musteriler
set is_kolu = 'Bank'
where is_kolu is null
  and sektor in ('Banka', 'BANKA', 'banka');

update public.musteriler m
set is_kolu = 'Vertical'
where m.is_kolu is null
  and (
    m.sektor in ('Vertical', 'VERTICAL', 'vertical')
    or exists (
      select 1 from public.system_parameters p
      where p.group_key = 'crm_sector'
        and p.value = m.sektor
        and p.meta->>'business_line' = 'vertical'
    )
  );

update public.musteriler
set is_kolu = 'Retail'
where is_kolu is null;

-- 4) İş kolu adı taşıyan sektörler boşaltılır; eski değer sektor_onceki'de KORUNUR.
--    (İŞ ORTAĞI da sektör olmaktan çıkar: iş ortaklığını müşteri tipi belirler.)
update public.musteriler
set sektor_onceki = sektor,
    sektor = null
where sektor in ('Banka', 'BANKA', 'banka', 'Vertical', 'VERTICAL', 'vertical', 'İŞ ORTAĞI', 'İş Ortağı', 'IS ORTAGI', 'Is Ortagi')
  and sektor_onceki is null;

-- 5) Bu değerler sektör kataloğundan pasife çekilir (dropdown'dan düşer; satır silinmez).
update public.system_parameters
set is_active = false,
    updated_at = now()
where group_key = 'crm_sector'
  and value in ('Banka', 'BANKA', 'banka', 'Vertical', 'VERTICAL', 'vertical', 'İŞ ORTAĞI', 'İş Ortağı', 'IS ORTAGI', 'Is Ortagi')
  and is_active = true;

-- ---------------------------------------------------------------------------
-- 6) Künye view'leri: İş Kolu artık müşteri kartından (m.is_kolu) okunur.
--    Tanımlar 007'deki hâlin birebir kopyasıdır; tek fark k.is_kolu → m.is_kolu.
-- ---------------------------------------------------------------------------

drop view if exists public.v_musteri_kunye_form cascade;
create view public.v_musteri_kunye_form as
 select m.id as musteri_id,
    m.musteri as firma_adi,
    m.sektor,
    k.account as musteri_account,
    k.id as kunye_id,
    k.magaza_sayisi,
    k.franchise_sayisi,
    k.sabit_kasa_adedi,
    k.kasapos_firmasi,
    k.pos_modeli,
    k.pos_markasi,
    k.toplam_pos_adedi,
    k.pos_alim_yili,
    k.sabit_bilgisayar_markasi,
    k.pos_notu,
    k.reyon_kullaniliyor,
    k.reyon_odeme_yazilimi,
    k.reyon_cihaz_modeli,
    k.reyon_cihaz_sayisi,
    k.reyon_alim_yili,
    k.el_terminali_kullaniliyor,
    k.el_terminali_modeli,
    k.el_terminali_yazilimi,
    k.el_terminali_adedi,
    k.el_terminali_alim_yili,
    k.erp,
    k.bankalar,
    k.pos_mulkiyet,
    k.pos_mulkiyet_bankalari,
    k.saha_hizmeti_firmasi,
    k.genel_memnuniyet,
    k.risk,
    k.entegrasyon_yapisi,
    m.is_kolu,
    k.satici_etiketi,
    k.problem_1,
    k.problem_2,
    k.problem_3,
    k.degisim_nedeni,
    k.created_at,
    k.updated_at
   from (public.musteriler m
     left join public.musteri_kunye_v2 k on ((k.musteri_id = m.id)));

drop view if exists public.v_musteri_kunye_status cascade;
create view public.v_musteri_kunye_status as
 with base as (
         select k.musteri_id,
            k.firma_adi,
            k.sektor,
            k.musteri_account,
            k.kunye_id,
            k.magaza_sayisi,
            k.franchise_sayisi,
            k.sabit_kasa_adedi,
            k.kasapos_firmasi,
            k.pos_modeli,
            k.pos_markasi,
            k.toplam_pos_adedi,
            k.pos_alim_yili,
            k.sabit_bilgisayar_markasi,
            k.pos_notu,
            k.reyon_kullaniliyor,
            k.reyon_odeme_yazilimi,
            k.reyon_cihaz_modeli,
            k.reyon_cihaz_sayisi,
            k.reyon_alim_yili,
            k.el_terminali_kullaniliyor,
            k.el_terminali_modeli,
            k.el_terminali_yazilimi,
            k.el_terminali_adedi,
            k.el_terminali_alim_yili,
            k.erp,
            k.bankalar,
            k.pos_mulkiyet,
            k.pos_mulkiyet_bankalari,
            k.saha_hizmeti_firmasi,
            k.genel_memnuniyet,
            k.risk,
            k.entegrasyon_yapisi,
            k.is_kolu,
            k.satici_etiketi,
            k.problem_1,
            k.problem_2,
            k.problem_3,
            k.degisim_nedeni,
            k.created_at,
            k.updated_at,
            ((((
                case when (k.magaza_sayisi is not null) then 1 else 0 end +
                case when (k.kasapos_firmasi is not null) then 1 else 0 end) +
                case when (k.pos_modeli is not null) then 1 else 0 end) +
                case when (k.pos_markasi is not null) then 1 else 0 end) +
                case when (k.toplam_pos_adedi is not null) then 1 else 0 end) as required_filled,
            (((((((((((((((((((((((((((((((
                case when (k.magaza_sayisi is not null) then 1 else 0 end +
                case when (k.franchise_sayisi is not null) then 1 else 0 end) +
                case when (k.sabit_kasa_adedi is not null) then 1 else 0 end) +
                case when (k.kasapos_firmasi is not null) then 1 else 0 end) +
                case when (k.pos_modeli is not null) then 1 else 0 end) +
                case when (k.pos_markasi is not null) then 1 else 0 end) +
                case when (k.toplam_pos_adedi is not null) then 1 else 0 end) +
                case when (k.pos_alim_yili is not null) then 1 else 0 end) +
                case when (k.sabit_bilgisayar_markasi is not null) then 1 else 0 end) +
                case when (k.pos_notu is not null) then 1 else 0 end) +
                case when (k.reyon_kullaniliyor is not null) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_odeme_yazilimi is not null)) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_cihaz_modeli is not null)) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_cihaz_sayisi is not null)) then 1 else 0 end) +
                case when ((k.reyon_kullaniliyor = 'Evet'::text) and (k.reyon_alim_yili is not null)) then 1 else 0 end) +
                case when (k.el_terminali_kullaniliyor is not null) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_modeli is not null)) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_yazilimi is not null)) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_adedi is not null)) then 1 else 0 end) +
                case when ((k.el_terminali_kullaniliyor = 'Evet'::text) and (k.el_terminali_alim_yili is not null)) then 1 else 0 end) +
                case when (k.erp is not null) then 1 else 0 end) +
                case when (k.bankalar is not null) then 1 else 0 end) +
                case when (k.pos_mulkiyet is not null) then 1 else 0 end) +
                case when ((k.pos_mulkiyet = 'Bankada'::text) and (k.pos_mulkiyet_bankalari is not null)) then 1 else 0 end) +
                case when (k.saha_hizmeti_firmasi is not null) then 1 else 0 end) +
                case when (k.genel_memnuniyet is not null) then 1 else 0 end) +
                case when (k.risk is not null) then 1 else 0 end) +
                case when (k.entegrasyon_yapisi is not null) then 1 else 0 end) +
                case when (k.problem_1 is not null) then 1 else 0 end) +
                case when (k.problem_2 is not null) then 1 else 0 end) +
                case when (k.problem_3 is not null) then 1 else 0 end) +
                case when (k.degisim_nedeni is not null) then 1 else 0 end) as filled_fields,
            (((((10 + 1) +
                case when (k.reyon_kullaniliyor = 'Evet'::text) then 4 else 0 end) + 1) +
                case when (k.el_terminali_kullaniliyor = 'Evet'::text) then 4 else 0 end) + 10) as total_fields
           from public.v_musteri_kunye_form k
        ), scored as (
         select b.musteri_id,
            b.firma_adi,
            b.sektor,
            b.musteri_account,
            b.kunye_id,
            b.magaza_sayisi,
            b.franchise_sayisi,
            b.sabit_kasa_adedi,
            b.kasapos_firmasi,
            b.pos_modeli,
            b.pos_markasi,
            b.toplam_pos_adedi,
            b.pos_alim_yili,
            b.sabit_bilgisayar_markasi,
            b.pos_notu,
            b.reyon_kullaniliyor,
            b.reyon_odeme_yazilimi,
            b.reyon_cihaz_modeli,
            b.reyon_cihaz_sayisi,
            b.reyon_alim_yili,
            b.el_terminali_kullaniliyor,
            b.el_terminali_modeli,
            b.el_terminali_yazilimi,
            b.el_terminali_adedi,
            b.el_terminali_alim_yili,
            b.erp,
            b.bankalar,
            b.pos_mulkiyet,
            b.pos_mulkiyet_bankalari,
            b.saha_hizmeti_firmasi,
            b.genel_memnuniyet,
            b.risk,
            b.entegrasyon_yapisi,
            b.is_kolu,
            b.satici_etiketi,
            b.problem_1,
            b.problem_2,
            b.problem_3,
            b.degisim_nedeni,
            b.created_at,
            b.updated_at,
            b.required_filled,
            b.filled_fields,
            b.total_fields,
            round((((b.filled_fields)::numeric / (greatest(b.total_fields, 1))::numeric) * (100)::numeric), 2) as completion_pct
           from base b
        )
 select musteri_id,
    firma_adi,
    sektor,
    musteri_account,
    kunye_id,
    magaza_sayisi,
    franchise_sayisi,
    sabit_kasa_adedi,
    kasapos_firmasi,
    pos_modeli,
    pos_markasi,
    toplam_pos_adedi,
    pos_alim_yili,
    sabit_bilgisayar_markasi,
    pos_notu,
    reyon_kullaniliyor,
    reyon_odeme_yazilimi,
    reyon_cihaz_modeli,
    reyon_cihaz_sayisi,
    reyon_alim_yili,
    el_terminali_kullaniliyor,
    el_terminali_modeli,
    el_terminali_yazilimi,
    el_terminali_adedi,
    el_terminali_alim_yili,
    erp,
    bankalar,
    pos_mulkiyet,
    pos_mulkiyet_bankalari,
    saha_hizmeti_firmasi,
    genel_memnuniyet,
    risk,
    entegrasyon_yapisi,
    is_kolu,
    satici_etiketi,
    problem_1,
    problem_2,
    problem_3,
    degisim_nedeni,
    created_at,
    updated_at,
    required_filled,
    filled_fields,
    total_fields,
    completion_pct,
        case
            when (required_filled <= 1) then 'yok'::text
            when (required_filled < 5) then 'eksik'::text
            when (completion_pct < (20)::numeric) then 'yok'::text
            when (completion_pct <= (60)::numeric) then 'eksik'::text
            else 'dolu'::text
        end as kunye_status
   from scored s;
