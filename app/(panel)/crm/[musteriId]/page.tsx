"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TimelineRow = {
  event_id: string;
  musteri_id: string;
  faz_no: number;
  faz_adi: string | null;
  iteration_no: number;
  event_type: string;
  durum: string | null;
  aksiyon: string | null;
  owner: string | null;
  partner_owner: string | null;
  baslangic_tarihi: string | null;
  hedef_tarihi: string | null;
  notlar: string | null;
  created_at: string;
};

type CustomerDetail = {
  id: string;
  musteri: string;
  sektor: string | null;
  entegrasyon_tipi: string | null;
  risk: string | null;
  sorumlu: string | null;
};

type KunyeStatus = { status: string; complete: boolean; missing: number };
type AllowedUser = { email: string; full_name: string | null; role: string; is_active: boolean };

type KunyeForm = {
  firma_adi: string;
  magaza_sayisi: string;
  toplam_pos_adedi: string;
  pos_modeli: string;
  pos_adedi: string;
  pos_notu: string;
  el_terminali_modeli: string;
  el_terminali_adedi: string;
  reyon_cihazi_modeli: string;
  reyon_cihazi_adedi: string;
  sabit_kasa_yazilimi: string;
  reyonda_odeme_yazilimi: string;
  erp: string;
  bankalar: string;
  pos_mulkiyet: string;
  saha_hizmeti_firmasi: string;
  genel_memnuniyet: string;
  problem_1: string;
  problem_2: string;
  problem_3: string;
  degisim_nedeni: string;
};

const EMPTY_KUNYE: KunyeForm = {
  firma_adi: "",
  magaza_sayisi: "",
  toplam_pos_adedi: "",
  pos_modeli: "",
  pos_adedi: "",
  pos_notu: "",
  el_terminali_modeli: "",
  el_terminali_adedi: "",
  reyon_cihazi_modeli: "",
  reyon_cihazi_adedi: "",
  sabit_kasa_yazilimi: "",
  reyonda_odeme_yazilimi: "",
  erp: "",
  bankalar: "",
  pos_mulkiyet: "",
  saha_hizmeti_firmasi: "",
  genel_memnuniyet: "",
  problem_1: "",
  problem_2: "",
  problem_3: "",
  degisim_nedeni: "",
};

const ENTEGRASYON_OPTIONS = ["A2A", "D2D", "D2D+A2A"] as const;

function toForm(input: Record<string, any> | null | undefined): KunyeForm {
  const base = { ...EMPTY_KUNYE };
  Object.keys(base).forEach((key) => {
    (base as any)[key] = String(input?.[key] ?? "");
  });
  return base;
}

export default function MusteriPage({ params }: { params: { musteriId: string } }) {
  const [events, setEvents] = useState<TimelineRow[]>([]);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [kunye, setKunye] = useState<KunyeForm>(EMPTY_KUNYE);
  const [kunyeStatus, setKunyeStatus] = useState<KunyeStatus | null>(null);
  const [fazNo, setFazNo] = useState<number>(1);
  const [notlar, setNotlar] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingKunye, setSavingKunye] = useState(false);
  const [allowed, setAllowed] = useState<AllowedUser[]>([]);

  const ownerOptions = useMemo(() => {
    const seen = new Set<string>();
    return allowed
      .map((u) => (u.full_name ?? "").trim())
      .filter((name) => name && !seen.has(name) && !!seen.add(name));
  }, [allowed]);

  const load = async () => {
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
      location.href = '/login';
      return;
    }

    const meJson = await meRes.json().catch(() => ({}));
    if (!["super_admin", "admin", "account_manager", "user"].includes(meJson?.me?.role ?? "")) {
      location.href = '/crm/activities';
      return;
    }

    const [timelineRes, detailRes, usersRes] = await Promise.all([
      fetch(`/api/crm/timeline?musteriId=${params.musteriId}`),
      fetch(`/api/crm/detail?musteriId=${params.musteriId}`),
      fetch('/api/allowed-users-lite'),
    ]);

    const timelineJson = await timelineRes.json().catch(() => ({}));
    if (!timelineRes.ok) {
      setMsg(timelineJson?.error === 'FORBIDDEN' ? 'Bu müşteri kaydını görüntüleme yetkin yok.' : (timelineJson?.error ?? 'Hata'));
      setEvents([]);
    } else {
      setEvents(timelineJson.events ?? []);
    }

    const detailJson = await detailRes.json().catch(() => ({}));
    if (detailRes.ok) {
      setCustomer(detailJson.musteri ?? null);
      setKunye(toForm(detailJson.kunye));
      setKunyeStatus(detailJson.kunyeStatus ?? null);
    } else {
      setMsg(detailJson?.message || 'Müşteri detayı yüklenemedi.');
    }

    if (usersRes.ok) {
      const uj = await usersRes.json().catch(() => ({}));
      setAllowed((uj.users ?? []).filter((x: AllowedUser) => (x.full_name ?? '').trim().length > 0));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addEvent = async () => {
    setMsg(null);
    if (!notlar.trim()) {
      setMsg("Not boş olamaz.");
      return;
    }

    const res = await fetch("/api/pipeline/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ musteriId: params.musteriId, fazNo, eventType: "note", notlar }),
    });

    const json = await res.json();
    if (!res.ok) {
      setMsg(json?.error ?? "Hata");
      return;
    }

    setNotlar("");
    setMsg("Event eklendi.");
    await load();
  };

  const saveCustomer = async () => {
    if (!customer) return;
    setSaveMsg(null);
    setSavingBasic(true);
    try {
      const res = await fetch('/api/crm/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ musteriId: customer.id, ...customer }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg(json?.message || 'Müşteri güncellenemedi.');
        return;
      }
      setSaveMsg('Müşteri bilgileri güncellendi.');
      await load();
    } finally {
      setSavingBasic(false);
    }
  };

  const saveKunye = async () => {
    setSaveMsg(null);
    setSavingKunye(true);
    try {
      const res = await fetch('/api/kunye', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ musteriId: params.musteriId, ...kunye }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMsg(json?.message || 'Künye kaydedilemedi.');
        return;
      }
      setKunyeStatus(json.status ?? null);
      setSaveMsg('Künye kaydedildi.');
    } finally {
      setSavingKunye(false);
    }
  };

  const statusStyle = kunyeStatus?.status === 'Var'
    ? { background: '#dcfce7', color: '#166534' }
    : kunyeStatus?.status === 'Eksik'
      ? { background: '#fef3c7', color: '#92400e' }
      : { background: '#fee2e2', color: '#991b1b' };

  return (
    <main style={{ maxWidth: 1120, margin: "30px auto", fontFamily: "system-ui", padding: 16 }}>
      <Link href="/crm" style={{ color: "#111" }}>← Listeye dön</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{customer?.musteri ?? 'Müşteri Detayı'}</h1>
          <p style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>Müşteri düzenleme, künye kaydı ve timeline aynı ekranda.</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800, ...statusStyle }}>
          Künye: {kunyeStatus?.status ?? 'Yok'}
          {kunyeStatus?.status === 'Eksik' ? ` (${kunyeStatus?.missing})` : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
        <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Müşteri Bilgileri</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Müşteri Adı
              <input value={customer?.musteri ?? ''} onChange={(e) => setCustomer((prev) => prev ? { ...prev, musteri: e.target.value } : prev)} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Sektör
              <input value={customer?.sektor ?? ''} onChange={(e) => setCustomer((prev) => prev ? { ...prev, sektor: e.target.value } : prev)} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Entegrasyon Tipi
              <select value={customer?.entegrasyon_tipi ?? ''} onChange={(e) => setCustomer((prev) => prev ? { ...prev, entegrasyon_tipi: e.target.value } : prev)} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}>
                <option value="">Seç...</option>
                {ENTEGRASYON_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Risk
              <input value={customer?.risk ?? ''} onChange={(e) => setCustomer((prev) => prev ? { ...prev, risk: e.target.value } : prev)} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Sorumlu
              <select value={customer?.sorumlu ?? ''} onChange={(e) => setCustomer((prev) => prev ? { ...prev, sorumlu: e.target.value } : prev)} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}>
                <option value="">Seç...</option>
                {ownerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={saveCustomer} disabled={savingBasic} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{savingBasic ? 'Kaydediliyor...' : 'Müşteri Bilgilerini Kaydet'}</button>
          </div>
        </section>

        <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Künye</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Örnek Excel’e göre gerekli alanlar tanımlandı. Gerekli alanlar dolmadan künye "Var" sayılmaz.</div>
            </div>
            <div style={{ fontSize: 12, color: '#4b5563' }}>Eksik gerekli alan: {kunyeStatus?.missing ?? 0}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {[
              ['firma_adi', 'Firma Adı'],
              ['magaza_sayisi', 'Mağaza Sayısı'],
              ['toplam_pos_adedi', 'Toplam POS Adedi'],
              ['pos_modeli', 'POS Modeli'],
              ['pos_adedi', 'POS Adedi'],
              ['pos_notu', 'POS Notu'],
              ['el_terminali_modeli', 'El Terminali Modeli'],
              ['el_terminali_adedi', 'El Terminali Adedi'],
              ['reyon_cihazi_modeli', 'Reyon Cihazı Modeli'],
              ['reyon_cihazi_adedi', 'Reyon Cihazı Adedi'],
              ['sabit_kasa_yazilimi', 'Sabit Kasa Yazılımı'],
              ['reyonda_odeme_yazilimi', 'Reyonda Ödeme Yazılımı'],
              ['erp', 'ERP'],
              ['bankalar', 'Bankalar'],
              ['pos_mulkiyet', 'POS Mülkiyet'],
              ['saha_hizmeti_firmasi', 'Saha Hizmeti Firması'],
              ['genel_memnuniyet', 'Genel Memnuniyet'],
              ['problem_1', 'Problem 1'],
              ['problem_2', 'Problem 2'],
              ['problem_3', 'Problem 3'],
              ['degisim_nedeni', 'Değişim Nedeni / Motivasyon'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'grid', gap: 6, fontSize: 13, gridColumn: key === 'degisim_nedeni' ? '1 / -1' : undefined }}>
                {label}
                {key === 'degisim_nedeni' || key.startsWith('problem_') || key === 'pos_notu' ? (
                  <textarea value={(kunye as any)[key]} onChange={(e) => setKunye((prev) => ({ ...prev, [key]: e.target.value }))} rows={key === 'degisim_nedeni' ? 4 : 3} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db', resize: 'vertical' }} />
                ) : (
                  <input value={(kunye as any)[key]} onChange={(e) => setKunye((prev) => ({ ...prev, [key]: e.target.value }))} style={{ padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }} />
                )}
              </label>
            ))}
          </div>

          {saveMsg ? <div style={{ marginTop: 12, fontSize: 13, color: '#065f46', background: '#ecfdf5', padding: 10, borderRadius: 10 }}>{saveMsg}</div> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={saveKunye} disabled={savingKunye} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #166534', background: '#166534', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{savingKunye ? 'Kaydediliyor...' : 'Künye Kaydet'}</button>
          </div>
        </section>

        <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Timeline</div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, margin: '12px 0' }}>
            <input type="number" value={fazNo} min={1} onChange={(e) => setFazNo(Number(e.target.value))} style={{ padding: 10, fontSize: 16, borderRadius: 10, border: '1px solid #d1d5db' }} />
            <input value={notlar} onChange={(e) => setNotlar(e.target.value)} placeholder="Not..." style={{ padding: 10, fontSize: 16, borderRadius: 10, border: '1px solid #d1d5db' }} />
            <button onClick={addEvent} style={{ padding: 10, cursor: 'pointer', borderRadius: 10, border: '1px solid #111827', background: '#111827', color: 'white' }}>Event Ekle</button>
          </div>
          {msg && <p style={{ marginTop: 0 }}>{msg}</p>}
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
            {events.map((ev) => (
              <li key={ev.event_id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>Faz {ev.faz_no} — {ev.faz_adi ?? '-'} / {ev.event_type}</div>
                <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>{new Date(ev.created_at).toLocaleString('tr-TR')}</div>
                <div style={{ marginTop: 8 }}>{ev.notlar ?? '-'}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
