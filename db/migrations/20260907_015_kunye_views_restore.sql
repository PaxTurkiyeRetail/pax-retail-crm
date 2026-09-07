-- 20260907_015_kunye_views_restore.sql
-- Künye view'lerini 008'deki tanıma geri getirir (satici_etiketi = Hunter/Farmer,
-- is_kolu müşteri kartından).
--
-- KÖK NEDEN (04.09 deploy): 004 baseline'ın checksum kilidi açıldığında 004
-- yeniden uygulandı; 004 içinde `drop view ... cascade; create view v_musteri_kunye_*`
-- var ve bu tanımlarda satici_etiketi / m.is_kolu YOK. 007 ve 008 "skip" edildiği
-- için view'ler baseline hâline geri döndü → künyede Hunter/Farmer ve İş Kolu
-- görünmez oldu (kayıt yazılıyor, view okumuyor).
--
-- Dosya idempotenttir. 004 bir daha yeniden uygulanırsa bu dosyanın da
-- crm_schema_migrations satırı silinip yeniden koşturulmalıdır (bkz. kılavuz §7).
-- Aşağıdaki tanımlar 20260902_008 §6 ile birebir aynıdır.

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
