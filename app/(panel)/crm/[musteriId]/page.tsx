"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ENTEGRASYON_OPTIONS, SATIS_OLASILIGI_OPTIONS } from '@/lib/crm';

type CustomerDetail = {
  id: string;
  musteri: string;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  satis_olasiligi: string | null;
  sorumlu: string | null;
};

type Kunye = Record<string, string | null | undefined>;
type KunyeStatus = { status: string; missing: number };


const KASAPOS_OPTIONS = ["Bilinmiyor", "PAX", "Ingenico", "Verifone", "Newland", "Diğer"];
const BANKA_OPTIONS = ["Akbank", "Garanti BBVA", "İş Bankası", "Yapı Kredi", "Halkbank", "VakıfBank", "Ziraat Bankası", "QNB", "TEB", "DenizBank"];
const POS_MULKIYET_OPTIONS = ["Kendisi", "Banka", "Bankada"];
const SAHA_HIZMETI_OPTIONS = ["Bilinmiyor", "Teknoser", "IBM", "Payser"];

const EMPTY_KUNYE: Kunye = {
franchise_sayisi: "", magaza_sayisi: "", toplam_pos_adedi: "", sabit_kasa_adedi: "", reyonda_kullanilan_cihaz_sayisi: "", kasapos_firmasi: "Bilinmiyor", pos_modeli: "", pos_notu: "", el_terminali_modeli: "", el_terminali_adedi: "", reyon_cihazi_modeli: "", reyon_cihazi_adedi: "", sabit_kasa_yazilimi: "", reyonda_odeme_yazilimi: "", erp: "", bankalar: "", pos_mulkiyet: "", pos_mulkiyet_bankalari: "", saha_hizmeti_firmasi: "", genel_memnuniyet: "", problem_1: "", problem_2: "", problem_3: "", degisim_nedeni: "",
};

function splitBanks(value: string | null | undefined) { return String(value ?? '').split(',').map((x) => x.trim()).filter(Boolean); }

export default function CustomerDetailPage() {
  const params = useParams<{ musteriId: string }>();
  const musteriId = String(params?.musteriId ?? '');
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [kunye, setKunye] = useState<Kunye>(EMPTY_KUNYE);
  const [initialKunye, setInitialKunye] = useState<Kunye>(EMPTY_KUNYE);
  const [status, setStatus] = useState<KunyeStatus>({ status: 'Yok', missing: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setMsg(null);
    const res = await fetch(`/api/crm/detail?musteriId=${musteriId}`, { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(payload?.message || 'Detay yüklenemedi');
    const musteri = payload.musteri as CustomerDetail;
    setDetail(musteri);
    const loadedKunye = { ...EMPTY_KUNYE, ...(payload.kunye ?? {}) };
    setKunye(loadedKunye);
    setInitialKunye(loadedKunye);
    setStatus(payload.kunyeStatus ? { ...payload.kunyeStatus, status: payload.kunyeStatus.status === 'Var' ? 'Tamam' : payload.kunyeStatus.status } : { status: 'Yok', missing: 0 });
  };

  useEffect(() => { if (musteriId) void load(); }, [musteriId]);

  const selectedBanks = useMemo(() => splitBanks(kunye.bankalar), [kunye.bankalar]);
  const selectedOwnershipBank = String(kunye.pos_mulkiyet_bankalari ?? '').trim();
  const setField = (key: string, value: string) => setKunye((prev) => ({ ...prev, [key]: value }));
  const toggleListValue = (key: 'bankalar' | 'pos_mulkiyet_bankalari', value: string) => {
    const current = new Set(splitBanks(kunye[key]));
    if (current.has(value)) current.delete(value); else current.add(value);
    setField(key, Array.from(current).join(', '));
  };

  const hasKunyeChanges = useMemo(() => JSON.stringify(kunye) !== JSON.stringify(initialKunye), [kunye, initialKunye]);

  const saveAll = async () => {
    if (!detail) return;
    setSaving(true);
    setMsg(null);
    try {
      const customerRes = await fetch('/api/crm/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ musteriId: detail.id, musteri: detail.musteri, sektor: detail.sektor, sorumlu: detail.sorumlu, entegrasyon_tipi: detail.entegrasyon_tipi, satis_olasiligi: detail.satis_olasiligi }) });
      const customerJson = await customerRes.json().catch(() => ({}));
      if (!customerRes.ok) return setMsg(customerJson?.message || 'Müşteri bilgileri kaydedilemedi');

      if (hasKunyeChanges) {
        const kuyeRes = await fetch('/api/kunye', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ musteriId: detail.id, ...kunye, pos_mulkiyet_bankalari: ['Banka','Bankada'].includes(String(kunye.pos_mulkiyet ?? '')) ? kunye.pos_mulkiyet_bankalari : null }) });
        const kuyeJson = await kuyeRes.json().catch(() => ({}));
        if (!kuyeRes.ok) return setMsg(kuyeJson?.message || 'Künye kaydedilemedi');
        setStatus(kuyeJson?.status ? { ...kuyeJson.status, status: kuyeJson.status.status === 'Var' ? 'Tamam' : kuyeJson.status.status } : { status: 'Tamam', missing: 0 });
        setInitialKunye(kunye);
        setMsg('Müşteri ve künye bilgileri kaydedildi.');
        return;
      }

      setMsg(customerJson?.message || 'Müşteri bilgileri kaydedildi.');
    } finally { setSaving(false); }
  };

  return (
    <main className="page">
      <style jsx>{`
        .page { display: grid; gap: 14px; }
        .hero, .surface, .stat { border: 1px solid #e2e8f0; background: #fff; border-radius: 18px; }
        .hero, .surface { padding: 16px; }
        .hero { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .title { margin: 0; font-size: 28px; color: #0f172a; }
        .sub { color: #64748b; font-size: 13px; margin-top: 4px; }
        .grid, .stats, .status-strip { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
        .two { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        .surface { display: grid; gap: 12px; }
        .section-title { margin: 0; font-size: 16px; color: #0f172a; }
        .field { display: grid; gap: 6px; }
        .label { font-size: 12px; font-weight: 800; color: #334155; }
        .input, .select, .textarea { min-height: 40px; border-radius: 12px; border: 1px solid #d5dee8; padding: 0 12px; font-size: 13px; width: 100%; }
        .textarea { min-height: 88px; padding: 10px 12px; resize: vertical; }
        .stat { padding: 12px 14px; }
        .stat-label { color: #64748b; font-size: 12px; }
        .stat-value { color: #0f172a; font-size: 18px; font-weight: 900; margin-top: 4px; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #d5dee8; border-radius: 999px; padding: 6px 10px; font-size: 12px; }
        .actions { display: flex; justify-content: flex-end; gap: 10px; }
        .secondary, .primary { min-height: 40px; border-radius: 12px; padding: 0 14px; font-weight: 800; cursor: pointer; }
        .secondary { border: 1px solid #d5dee8; background: #fff; }
        .primary { border: 1px solid #0f172a; background: #0f172a; color: #fff; }
        .message { color: #166534; background: #ecfdf3; border: 1px solid #bbf7d0; padding: 10px 12px; border-radius: 12px; font-size: 13px; }
        @media (max-width: 920px) { .grid, .stats, .two, .status-strip { grid-template-columns: 1fr; } .actions { width:100%; } .actions > :global(button) { flex:1 1 auto; } }
      `}</style>

      <section className="hero"><div><h1 className="title">{detail?.musteri ?? 'Müşteri Detayı'}</h1><div className="sub">Risk alanları Satış Olasılığı olarak güncellendi. Bankalar alanı Hangi bankalar oldu ve banka mülkiyetinde ek banka seçimi açıldı.</div></div><div className="actions"><button className="secondary" onClick={() => history.back()}>Geri</button><button className="primary" onClick={saveAll} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></div></section>
      <section className="stats"><div className="stat"><div className="stat-label">Müşteri Adı</div><div className="stat-value">{detail?.musteri ?? '-'}</div></div><div className="stat"><div className="stat-label">Sektör</div><div className="stat-value">{detail?.sektor ?? '-'}</div></div><div className="stat"><div className="stat-label">Sorumlusu</div><div className="stat-value">{detail?.sorumlu ?? '-'}</div></div></section>
      {msg ? <div className="message">{msg}</div> : null}
      <section className="status-strip"><div className="stat"><div className="stat-label">Künye Durumu</div><div className="stat-value">{status.status}</div></div><div className="stat"><div className="stat-label">Eksik Alan</div><div className="stat-value">{status.missing}</div></div><div className="stat"><div className="stat-label">Mobil Uyum</div><div className="stat-value">Hazır</div></div></section>

      <section className="surface"><h2 className="section-title">Opsiyonel Müşteri Bilgileri</h2><div className="two"><label className="field"><span className="label">Entegrasyon Yapısı</span><select className="select" value={detail?.entegrasyon_tipi ?? ''} onChange={(e) => setDetail((prev) => prev ? { ...prev, entegrasyon_tipi: e.target.value || null } : prev)}>{ENTEGRASYON_OPTIONS.map((opt) => <option key={opt || 'bos'} value={opt}>{opt || 'Seçilmedi'}</option>)}</select></label><label className="field"><span className="label">Satış Olasılığı</span><select className="select" value={detail?.satis_olasiligi ?? ''} onChange={(e) => setDetail((prev) => prev ? { ...prev, satis_olasiligi: e.target.value || null } : prev)}>{SATIS_OLASILIGI_OPTIONS.map((opt) => <option key={opt || 'bos'} value={opt}>{opt || 'Seçilmedi'}</option>)}</select></label></div></section>

      <section className="surface"><h2 className="section-title">1) Firma Bilgisi</h2><div className="grid"><label className="field"><span className="label">Müşteri Adı</span><input className="input" value={detail?.musteri ?? ''} readOnly /></label><label className="field"><span className="label">Mağaza Sayısı</span><input className="input" value={kunye.magaza_sayisi ?? ''} onChange={(e) => setField('magaza_sayisi', e.target.value)} /></label><label className="field"><span className="label">Franchise Sayısı</span><input className="input" value={kunye.franchise_sayisi ?? ''} onChange={(e) => setField('franchise_sayisi', e.target.value)} /></label></div></section>
      <section className="surface"><h2 className="section-title">2) Yazılım & ERP</h2><div className="grid"><label className="field"><span className="label">Sabit Kasa Yazılımı</span><input className="input" value={kunye.sabit_kasa_yazilimi ?? ''} onChange={(e) => setField('sabit_kasa_yazilimi', e.target.value)} /></label><label className="field"><span className="label">Sabit Kasa Adedi</span><input className="input" value={kunye.sabit_kasa_adedi ?? ''} onChange={(e) => setField('sabit_kasa_adedi', e.target.value)} /></label><label className="field"><span className="label">Reyonda Ödeme Yazılımı</span><input className="input" value={kunye.reyonda_odeme_yazilimi ?? ''} onChange={(e) => setField('reyonda_odeme_yazilimi', e.target.value)} /></label><label className="field"><span className="label">Reyonda Kullanılan Cihaz Sayısı</span><input className="input" value={kunye.reyonda_kullanilan_cihaz_sayisi ?? ''} onChange={(e) => setField('reyonda_kullanilan_cihaz_sayisi', e.target.value)} /></label><label className="field" style={{ gridColumn: '1 / -1' }}><span className="label">ERP Yazılımı</span><input className="input" value={kunye.erp ?? ''} onChange={(e) => setField('erp', e.target.value)} /></label></div></section>
      <section className="surface"><h2 className="section-title">3) POS & Cihaz Envanteri</h2><div className="grid"><label className="field"><span className="label">KasaPOS Firması</span><select className="select" value={kunye.kasapos_firmasi ?? 'Bilinmiyor'} onChange={(e) => setField('kasapos_firmasi', e.target.value)}>{KASAPOS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></label><label className="field"><span className="label">POS Cihazı Markası ve Modeli</span><input className="input" value={kunye.pos_modeli ?? ''} onChange={(e) => setField('pos_modeli', e.target.value)} /></label><label className="field"><span className="label">POS Cihazı Adedi</span><input className="input" value={kunye.toplam_pos_adedi ?? ''} onChange={(e) => setField('toplam_pos_adedi', e.target.value)} /></label><label className="field" style={{ gridColumn: '1 / -1' }}><span className="label">POS Notu</span><input className="input" value={kunye.pos_notu ?? ''} onChange={(e) => setField('pos_notu', e.target.value)} /></label><label className="field"><span className="label">El Terminali Modeli</span><input className="input" value={kunye.el_terminali_modeli ?? ''} onChange={(e) => setField('el_terminali_modeli', e.target.value)} /></label><label className="field"><span className="label">El Terminali Adedi</span><input className="input" value={kunye.el_terminali_adedi ?? ''} onChange={(e) => setField('el_terminali_adedi', e.target.value)} /></label><label className="field"><span className="label">Reyon Cihazı Modeli</span><input className="input" value={kunye.reyon_cihazi_modeli ?? ''} onChange={(e) => setField('reyon_cihazi_modeli', e.target.value)} /></label><label className="field"><span className="label">Reyon Cihazı Adedi</span><input className="input" value={kunye.reyon_cihazi_adedi ?? ''} onChange={(e) => setField('reyon_cihazi_adedi', e.target.value)} /></label></div></section>
      <section className="surface"><h2 className="section-title">4) Banka / Sahiplik / Saha Hizmeti</h2><div className="field"><span className="label">Hangi bankalar</span><div className="chips">{BANKA_OPTIONS.map((bank) => <label key={bank} className="chip"><input type="checkbox" checked={selectedBanks.includes(bank)} onChange={() => toggleListValue('bankalar', bank)} /> {bank}</label>)}</div></div><div className="two"><label className="field"><span className="label">POS Cihazı Mülkiyeti</span><select className="select" value={kunye.pos_mulkiyet ?? ''} onChange={(e) => setField('pos_mulkiyet', e.target.value)}><option value="">Seçiniz</option>{POS_MULKIYET_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></label><label className="field"><span className="label">Saha Hizmeti Firması</span><select className="select" value={kunye.saha_hizmeti_firmasi ?? ''} onChange={(e) => setField('saha_hizmeti_firmasi', e.target.value)}><option value="">Seçiniz</option>{SAHA_HIZMETI_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></label></div>{['Banka','Bankada'].includes(String(kunye.pos_mulkiyet ?? '')) ? <div className="field"><span className="label">POS cihazı hangi bankaya ait</span><div className="chips">{BANKA_OPTIONS.map((bank) => <label key={bank} className="chip"><input type="radio" name="pos_mulkiyet_bankasi" checked={selectedOwnershipBank === bank} onChange={() => setField('pos_mulkiyet_bankalari', bank)} /> {bank}</label>)}</div></div> : null}</section>
      <section className="surface"><h2 className="section-title">5) Memnuniyet & Problemler</h2><div className="grid"><label className="field"><span className="label">Genel Memnuniyet</span><input className="input" value={kunye.genel_memnuniyet ?? ''} onChange={(e) => setField('genel_memnuniyet', e.target.value)} /></label><label className="field"><span className="label">Problem 1</span><input className="input" value={kunye.problem_1 ?? ''} onChange={(e) => setField('problem_1', e.target.value)} /></label><label className="field"><span className="label">Problem 2</span><input className="input" value={kunye.problem_2 ?? ''} onChange={(e) => setField('problem_2', e.target.value)} /></label><label className="field"><span className="label">Problem 3</span><input className="input" value={kunye.problem_3 ?? ''} onChange={(e) => setField('problem_3', e.target.value)} /></label></div></section>
      <section className="surface"><h2 className="section-title">6) Değişim Nedeni</h2><label className="field"><span className="label">Değişim Nedeni / Motivasyon</span><textarea className="textarea" value={kunye.degisim_nedeni ?? ''} onChange={(e) => setField('degisim_nedeni', e.target.value)} /></label><div className="chips"><span className="chip">Künye Durumu: {status.status}</span><span className="chip">Eksik Alan: {status.missing}</span></div></section>
    </main>
  );
}
