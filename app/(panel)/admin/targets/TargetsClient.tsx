'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUARTERLY_TARGET_CODES,
  QUARTER_INDEXES,
  TARGET_DEFINITIONS,
  normalizeTargetValue,
  quarterOf,
  splitYearlyToQuarters,
  type Quarter,
  type TargetCode,
  type TargetsAdminPayload,
  type TargetsAdminUser,
} from '@/lib/reports/targets-shared';
import '@/styles/targets.css';

// Hedefler — Yönetim › Hedefler (Çağdaş Bey, 10.09.2026).
//   * Kişi kartı: haftalık aktivite · yıl hedefleri · çeyrek hedefleri (bütçe, ziyaret, entegrasyon).
//   * v2.9 (11.09): entegrasyon çeyreğe bölünür; kapsanan firma ve ortalama temas / firma eklendi.
//   * Boş bırakılan alan = hedef yok (kayıt silinir); çeyrek boşsa Canlı Ekran yıllık/4'ü varsayar.
//   * YIL ↔ ÇEYREK canlı bağlıdır (Sinan, 10.09): yıllık yazılınca 4 çeyreğe bölünür (kalan son
//     çeyreklere eklenir: 101 → 25·25·25·26); bir çeyrek elle değişince yıllık = çeyrek toplamı
//     (Q3'ü 25 → 26 yapmak yıllığı 100 → 101 yapar). Böylece iki kutu asla çelişmez.
//   * Para alanları yazarken binlik ayracıyla gösterilir (1.500.000); kaydederken sayıya iner.
//   * Kaydet kişi başına; gönderilmeyen alan yok — kartın tüm alanları birlikte yazılır.
//   * Toast'lar AppToaster'dan (PUT otomatik); burada ayrıca toast basılmaz.
//   * API: GET/PUT /api/admin/targets.

type Draft = {
  weeklyTotal: string;
  yearly: Record<TargetCode, string>;
  quarterly: Record<TargetCode, [string, string, string, string]>;
};

const CODES = TARGET_DEFINITIONS.map((d) => d.code);

function toDraft(user: TargetsAdminUser): Draft {
  const yearly = Object.fromEntries(CODES.map((code) => [code, user.yearly[code] != null ? String(user.yearly[code]) : ''])) as Record<TargetCode, string>;
  const quarterly = Object.fromEntries(CODES.map((code) => [
    code,
    (user.quarterly[code] ?? [null, null, null, null]).map((v) => (v != null ? String(v) : '')) as [string, string, string, string],
  ])) as Record<TargetCode, [string, string, string, string]>;
  return { weeklyTotal: user.weeklyTotal ? String(user.weeklyTotal) : '', yearly, quarterly };
}

function sameDraft(a: Draft, b: Draft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fmtNum(value: number | null | undefined) {
  return value == null ? '—' : Number(value).toLocaleString('tr-TR');
}

/**
 * Tüm hedef alanları yalnız RAKAM kabul eder (Sinan, 10.09: "number dışında karakter koymasına izin verme").
 * `type="number"` yetmiyor — tarayıcı `e`, `+`, `-`, `,` kabul ediyor; bu yüzden metin alanı + `digitsOnly`.
 * Para alanları ayrıca ekranda 3 basamakta bir noktayla gösterilir (`withThousands`); adet alanları sade tam sayı.
 */
function digitsOnly(value: string) {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}
function withThousands(value: string) {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString('tr-TR') : '';
}

/**
 * Yıllık hedefi 4 çeyreğe böler; bölünmeyen kalanı SON çeyreklere ekler
 * (100 → 25·25·25·25, 101 → 25·25·25·26, 102 → 25·25·26·26). Boş yıllık → boş çeyrekler.
 */
function splitToQuarters(yearly: string): [string, string, string, string] {
  return splitYearlyToQuarters(normalizeTargetValue(yearly))
    .map((value) => (value == null ? '' : String(value))) as [string, string, string, string];
}

/** Çeyrek toplamı (boşlar 0). Hepsi boşsa null → yıllık alana dokunulmaz. */
function sumQuarters(values: readonly string[]): number | null {
  if (values.every((value) => !String(value).trim())) return null;
  return values.reduce((acc, value) => acc + (normalizeTargetValue(value) ?? 0), 0);
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => ({}));
  return (json?.message as string) || fallback;
}

export default function TargetsClient() {
  const currentYear = new Date().getFullYear();
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const [year, setYear] = useState(currentYear);
  const [payload, setPayload] = useState<TargetsAdminPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/targets?year=${targetYear}`, { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(await readError(res, 'Hedefler yüklenemedi.'));
      const json = (await res.json()) as TargetsAdminPayload;
      setPayload(json);
      setDrafts(Object.fromEntries(json.users.map((user) => [user.id, toDraft(user)])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hedefler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(year); }, [year, load]);

  const currentQuarter = useMemo(() => (year === Number(todayKey.slice(0, 4)) ? quarterOf(todayKey).index : null), [year, todayKey]);

  const totals = useMemo(() => {
    const sum = (code: TargetCode) => (payload?.users ?? []).reduce((acc, user) => acc + (user.yearly[code] ?? 0), 0);
    const missing = (payload?.users ?? []).filter((user) => user.yearly.sales_revenue == null || user.yearly.visit_count == null).length;
    return { budget: sum('sales_revenue'), visits: sum('visit_count'), won: sum('quotes_won_count'), missing };
  }, [payload]);

  const setField = (userId: string, patch: (draft: Draft) => Draft) => {
    setDrafts((prev) => ({ ...prev, [userId]: patch(prev[userId]) }));
  };

  const save = async (user: TargetsAdminUser) => {
    const draft = drafts[user.id];
    if (!draft) return;
    setSaving((prev) => ({ ...prev, [user.id]: true }));
    try {
      const res = await fetch('/api/admin/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          userId: user.id,
          weeklyTotal: draft.weeklyTotal,
          yearly: draft.yearly,
          quarterly: Object.fromEntries(QUARTERLY_TARGET_CODES.map((code) => [code, draft.quarterly[code]])),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Hedefler kaydedilemedi.'));
      const json = (await res.json()) as { user: TargetsAdminUser };
      setPayload((prev) => (prev ? { ...prev, users: prev.users.map((row) => (row.id === user.id ? json.user : row)) } : prev));
      setDrafts((prev) => ({ ...prev, [user.id]: toDraft(json.user) }));
      setSavedAt((prev) => ({ ...prev, [user.id]: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hedefler kaydedilemedi.');
    } finally {
      setSaving((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters: Quarter[] = payload?.quarters ?? [];

  return (
    <div className="tg-shell">
      <section className="tg-hero">
        <div className="tg-hero-copy">
          <span className="tg-eyebrow">Yönetim · Hedefler</span>
          <h1>Hedefler · {year}</h1>
          <p>
            Satış ekibinin kişi bazlı hedefleri. Canlı Ekran kişi slaytındaki donut&apos;lar buradan beslenir:
            <b> haftalık aktivite</b>, <b>çeyrek ve yıl ziyaret</b>, <b>yıl ve çeyrek bütçe</b>,
            <b> çeyrek ve yıl entegrasyon</b>, <b>Hunter → Farmer</b> ve <b>Lead → Hunter</b> çevirme,
            <b> kazanılan teklif</b>, <b>kapsanan firma</b> ve <b>ortalama temas</b>.
            Boş bırakılan alan &quot;hedef yok&quot; demektir. Yıllık hedef çeyreklere otomatik bölünür; bir çeyreği elle
            değiştirirsen yıllık toplam ona göre güncellenir.
          </p>
        </div>
        <div className="tg-hero-actions">
          <label className="tg-year">
            <span>Yıl</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Hedef yılı">
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button type="button" className="tg-btn light" onClick={() => void load(year)} disabled={loading}>↻ Yenile</button>
        </div>
      </section>

      <section className="tg-kpis" aria-label="Özet">
        <div className="tg-kpi"><span>Kişi</span><strong>{payload?.users.length ?? '—'}</strong><small>hedef girilebilen satışçı</small></div>
        <div className="tg-kpi"><span>Yıllık bütçe toplamı</span><strong>{payload ? `$${fmtNum(totals.budget)}` : '—'}</strong><small>kişi hedeflerinin toplamı</small></div>
        <div className="tg-kpi"><span>Yıllık ziyaret toplamı</span><strong>{payload ? fmtNum(totals.visits) : '—'}</strong><small>fiziki + online görüşme</small></div>
        <div className="tg-kpi"><span>Kazanılan teklif hedefi</span><strong>{payload ? fmtNum(totals.won) : '—'}</strong><small>adet · yıl</small></div>
        <div className={`tg-kpi ${totals.missing ? 'warn' : ''}`}><span>Hedefi eksik</span><strong>{payload ? totals.missing : '—'}</strong><small>bütçe ya da ziyaret girilmemiş</small></div>
      </section>

      {error ? <div className="tg-error" role="alert">{error}</div> : null}
      {loading && !payload ? <div className="tg-empty">Hedefler yükleniyor…</div> : null}
      {payload && !payload.users.length ? <div className="tg-empty">Hedef girilebilecek aktif satışçı bulunamadı.</div> : null}

      <div className="tg-people">
        {payload?.users.map((user) => {
          const draft = drafts[user.id] ?? toDraft(user);
          const dirty = !sameDraft(draft, toDraft(user));
          const busy = Boolean(saving[user.id]);
          return (
            <section className={`tg-person ${dirty ? 'dirty' : ''}`} key={user.id} aria-label={`${user.name} hedefleri`}>
              <header className="tg-person-head">
                <div>
                  <h2>{user.name}</h2>
                  <span>{user.email}</span>
                </div>
                <div className="tg-person-actions">
                  {savedAt[user.id] && !dirty ? <em>Kaydedildi {savedAt[user.id]}</em> : dirty ? <em className="pending">Kaydedilmemiş değişiklik</em> : null}
                  <button type="button" className="tg-btn" onClick={() => setDrafts((prev) => ({ ...prev, [user.id]: toDraft(user) }))} disabled={!dirty || busy}>Geri al</button>
                  <button type="button" className="tg-btn primary" onClick={() => void save(user)} disabled={!dirty || busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
                </div>
              </header>

              <div className="tg-grid">
                <div className="tg-block">
                  <h3>Haftalık</h3>
                  <label className="tg-field">
                    <span>Aktivite hedefi <small>adet / hafta</small></span>
                    <input type="text" inputMode="numeric" value={draft.weeklyTotal} placeholder="20"
                      onChange={(event) => setField(user.id, (d) => ({ ...d, weeklyTotal: digitsOnly(event.target.value) }))} />
                  </label>
                  <p className="tg-note">Kanal kırılımı (görüşme / temas) Kullanıcı Yönetimi › Hedefleri Düzenle&apos;de kalır.</p>
                </div>

                <div className="tg-block">
                  <h3>Yıl · {year}</h3>
                  <div className="tg-fields">
                    {TARGET_DEFINITIONS.map((def) => (
                      <label className="tg-field" key={def.code} title={def.hint}>
                        <span>{def.label}{def.unit === 'money' ? <small>USD</small> : <small>adet</small>}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={def.unit === 'money' ? withThousands(draft.yearly[def.code]) : draft.yearly[def.code]}
                          placeholder="—"
                          onChange={(event) => {
                            const raw = digitsOnly(event.target.value);
                            setField(user.id, (d) => {
                              const next = { ...d, yearly: { ...d.yearly, [def.code]: raw } };
                              // Yıllık girildi → çeyreklere böl (yalnız çeyreği olan hedefler).
                              if (QUARTERLY_TARGET_CODES.includes(def.code)) {
                                next.quarterly = { ...d.quarterly, [def.code]: splitToQuarters(raw) };
                              }
                              return next;
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="tg-block tg-quarters">
                  <h3>Çeyrekler</h3>
                  <div className="tg-qtable" role="table">
                    <div className="tg-qrow tg-qhead" role="row">
                      <span role="columnheader">Hedef</span>
                      {quarters.map((q) => (
                        <span role="columnheader" key={q.index} className={currentQuarter === q.index ? 'now' : ''}>
                          {q.label}<small>{q.months}</small>
                        </span>
                      ))}
                      <span role="columnheader">Toplam</span>
                    </div>
                    {QUARTERLY_TARGET_CODES.map((code) => {
                      const def = TARGET_DEFINITIONS.find((d) => d.code === code)!;
                      const values = draft.quarterly[code];
                      const sum = values.reduce((acc, v) => acc + (normalizeTargetValue(v) ?? 0), 0);
                      const yearValue = normalizeTargetValue(draft.yearly[code]);
                      const mismatch = yearValue != null && sum > 0 && sum !== yearValue;
                      return (
                        <div className="tg-qrow" role="row" key={code}>
                          <span role="rowheader">{def.label}</span>
                          {QUARTER_INDEXES.map((index) => (
                            <span role="cell" key={index} className={currentQuarter === index ? 'now' : ''}>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={def.unit === 'money' ? withThousands(values[index - 1]) : values[index - 1]}
                                placeholder={yearValue != null ? fmtNum(Math.floor(yearValue / 4)) : '—'}
                                aria-label={`${def.label} Q${index}`}
                                onChange={(event) => {
                                  const raw = digitsOnly(event.target.value);
                                  setField(user.id, (d) => {
                                    const nextQuarters = [...d.quarterly[code]] as [string, string, string, string];
                                    nextQuarters[index - 1] = raw;
                                    // Çeyrek elle değişti → yıllık = çeyrek toplamı (Sinan: Q3 25→26 ise yıl 100→101).
                                    const total = sumQuarters(nextQuarters);
                                    return {
                                      ...d,
                                      quarterly: { ...d.quarterly, [code]: nextQuarters },
                                      yearly: { ...d.yearly, [code]: total == null ? '' : String(total) },
                                    };
                                  });
                                }}
                              />
                            </span>
                          ))}
                          {/* Yıl ↔ çeyrek senkron olduğu için normalde tek sayı: toplam. Elle bozulmuş
                              (eski) kayıtlarda yıllık değer de sarı ile gösterilir. */}
                          <span role="cell" className={`tg-qsum ${mismatch ? 'warn' : ''}`}>
                            {sum ? fmtNum(sum) : '—'}{mismatch ? ` ≠ yıl ${fmtNum(yearValue)}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="tg-note">
                    Yıllık hedef yazılınca çeyreklere bölünür (kalan son çeyreklere eklenir: 101 → 25·25·25·<b>26</b>).
                    Bir çeyreği elle değiştirirsen yıllık toplam onu takip eder — Q3&apos;ü 25&apos;ten 26&apos;ya çıkarmak yıllığı 101 yapar.
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
