'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/styles/live-board.css';
import { WEEKLY_TARGET_LABELS, achievementPct } from '@/lib/reports/weekly-targets-shared';
import {
  LIVE_BOARD_SPEEDS,
  LIVE_BOARD_TIMING,
  slideDurationMs,
  slidePlan,
  type LiveActivity,
  type LiveBoardPayload,
  type LiveBoardSpeed,
  type LiveFollowup,
  type LiveOwner,
  type LiveSlide,
} from '@/lib/reports/live-board-shared';

// Canlı Ekran — yöneticinin açıp bıraktığı, kendi kendine dönen pano.
//
// Davranış:
//   • Slaytlar: Takım Özeti → kişi → kişi → … (her 4 kişide özet tekrar gelir).
//   • Süre: özet 15 sn, kişi 12 sn; hız seçimi ×1.6 / ×1 / ×0.65 (localStorage'da kalır).
//   • Veri: /api/reports/live-board, 5 dakikada bir sessizce yenilenir; sekme
//     görünür olduğunda da yenilenir. Yenileme mevcut slaytı bozmaz.
//   • Kontroller: fareyle hareket edince görünür, 3 sn sonra gizlenir (TV'de temiz ekran).
//     Klavye: Boşluk duraklat · ← → gezin · F tam ekran · R yenile.
//   • Tam ekran: Fullscreen API (kullanıcı tıklaması gerekir — tarayıcı kuralı).
//   • Ekran uyumasın: Wake Lock API (destekleyen tarayıcılarda; yoksa sessizce geçer).

const SPEED_KEY = 'pax-live-board-speed';
const CONTROLS_HIDE_MS = 3000;

function fmt(value: number) {
  return Number(value ?? 0).toLocaleString('tr-TR');
}
function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}
// Saatler her zaman Türkiye saatiyle: pano başka dilimdeki bir tarayıcı/TV'de
// açılsa da ekip saatini gösterir.
const TZ = 'Europe/Istanbul';
function fmtClock(date: Date) {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
function fmtWhen(iso: string, todayKey: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const day = date.toLocaleDateString('en-CA', { timeZone: TZ });
  if (day === todayKey) return `Bugün ${time}`;
  return `${date.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: TZ })} ${time}`;
}
function pctClass(pct: number | null) {
  if (pct == null) return '';
  if (pct >= 100) return 'over';
  if (pct < 50) return 'low';
  return '';
}
function readSpeed(): LiveBoardSpeed {
  try {
    const saved = localStorage.getItem(SPEED_KEY);
    if (saved === 'slow' || saved === 'fast' || saved === 'normal') return saved;
  } catch {}
  return 'normal';
}

/* --- Küçük parçalar ----------------------------------------------------- */

function Ring({ actual, target }: { actual: number; target: number }) {
  const pct = achievementPct(actual, target);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const filled = pct == null ? 0 : Math.min(100, pct) / 100 * circumference;
  return (
    <div className="lb-ring" role="img" aria-label={pct == null ? `${actual} aktivite` : `Hedefin %${pct}'i`}>
      <svg viewBox="0 0 100 100">
        <circle className="track" cx="50" cy="50" r={radius} />
        <circle className={`value ${pctClass(pct)}`} cx="50" cy="50" r={radius} strokeDasharray={`${filled} ${circumference}`} />
      </svg>
      <div className="lb-ring-center">
        <strong>{pct == null ? fmt(actual) : `%${pct}`}</strong>
        <span>{pct == null ? 'aktivite' : `${fmt(actual)} / ${fmt(target)}`}</span>
      </div>
    </div>
  );
}

function Bar({ actual, target }: { actual: number; target: number }) {
  const pct = achievementPct(actual, target);
  const width = pct == null ? (actual > 0 ? 100 : 0) : Math.min(100, pct);
  return <div className="lb-bar"><span className={pctClass(pct)} style={{ width: `${width}%` }} /></div>;
}

function FollowupList({ rows, empty }: { rows: LiveFollowup[]; empty: string }) {
  if (!rows.length) return <div className="lb-item-sub">{empty}</div>;
  return (
    <div className="lb-list">
      {rows.map((row) => (
        <div className="lb-item" key={`${row.customerId}-${row.cozumTarihi ?? ''}`}>
          <div className="lb-item-main">
            <div className="lb-item-title">{row.musteri}</div>
            <div className="lb-item-sub">{row.takipKonusu}{row.konuKimde && row.konuKimde !== '—' ? ` · ${row.konuKimde}` : ''}</div>
          </div>
          <div className="lb-item-side">
            <span className={`lb-pill ${row.overdue ? 'overdue' : row.nearTerm ? 'near' : ''}`}>{fmtDate(row.cozumTarihi)}</span>
            {row.modelAdetLabel && row.modelAdetLabel !== '—' ? <small>{row.modelAdetLabel}</small> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityList({ rows, todayKey }: { rows: LiveActivity[]; todayKey: string }) {
  if (!rows.length) return <div className="lb-item-sub">Bu hafta henüz hareket yok.</div>;
  return (
    <div className="lb-list">
      {rows.map((row) => (
        <div className="lb-item" key={row.id}>
          <div className="lb-item-main">
            <div className="lb-item-title">{row.musteri}</div>
            {row.note ? <div className="lb-item-sub">{row.note}</div> : null}
          </div>
          <div className="lb-item-side">
            <span className={`lb-pill ${row.kind.startsWith('technical') ? 'tech' : row.kind === 'other' ? '' : 'kind'}`}>{row.label}</span>
            <small>{fmtWhen(row.at, todayKey)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- Slaytlar ------------------------------------------------------------ */

function OverviewSlide({ data }: { data: LiveBoardPayload }) {
  const { team, owners, range } = data;
  const maxActivities = Math.max(1, ...owners.map((row) => Math.max(row.actual.totalActivities, row.target.totalActivities)));
  return (
    <div className="lb-slide" key="overview">
      <div className="lb-kpis">
        <div className="lb-kpi accent">
          <div className="lb-kpi-label">Aktivite · Hafta</div>
          <div className="lb-kpi-value">{fmt(team.actual.totalActivities)}{team.target.totalActivities ? <small>/ {fmt(team.target.totalActivities)}</small> : null}</div>
          <div className="lb-kpi-sub">{team.achievementPct == null ? 'Hedef tanımlı değil' : `Hedefin %${team.achievementPct}'i`}</div>
        </div>
        <div className="lb-kpi">
          <div className="lb-kpi-label">Tekil Firma</div>
          <div className="lb-kpi-value">{fmt(team.actual.uniqueCustomers)}</div>
          <div className="lb-kpi-sub">Bu hafta temas edilen</div>
        </div>
        <div className="lb-kpi ok">
          <div className="lb-kpi-label">Bugün</div>
          <div className="lb-kpi-value">{fmt(team.todayActivities)}</div>
          <div className="lb-kpi-sub">Bugün girilen aktivite</div>
        </div>
        <div className="lb-kpi">
          <div className="lb-kpi-label">Teklif · Hafta</div>
          <div className="lb-kpi-value">{fmt(team.quotes.count)}{team.quotes.devices ? <small>{fmt(team.quotes.devices)} cihaz</small> : null}</div>
          <div className="lb-kpi-sub">Bu hafta oluşturulan</div>
        </div>
        <div className={`lb-kpi ${team.followups.overdue ? 'danger' : ''}`}>
          <div className="lb-kpi-label">Açık Takip</div>
          <div className="lb-kpi-value">{fmt(team.followups.open)}</div>
          <div className="lb-kpi-sub">{team.followups.overdue ? `${fmt(team.followups.overdue)} tanesinin tarihi geçti` : 'Tarihi geçen yok'}</div>
        </div>
        <div className="lb-kpi warn">
          <div className="lb-kpi-label">Yakın Vadeli Adet</div>
          <div className="lb-kpi-value">{fmt(team.followups.nearTermQuantity)}</div>
          <div className="lb-kpi-sub">{team.followups.nearTermLabel || 'Önümüzdeki 3 ay'}</div>
        </div>
      </div>

      <div className="lb-cols">
        <div className="lb-card">
          <div className="lb-card-head"><h3>Haftanın Sıralaması</h3><span>{range.label} · {team.ownerCount} kişi</span></div>
          {owners.length ? (
            <div className="lb-board">
              {owners.map((row) => (
                <div className="lb-row" key={row.owner}>
                  <div className={`lb-rank r${row.rank}`}>{row.rank}</div>
                  <div className="lb-row-main">
                    <div className="lb-row-name">
                      <span>{row.owner}</span>
                      <em>{row.actual.uniqueCustomers} firma{row.todayActivities ? ` · bugün ${row.todayActivities}` : ''}</em>
                    </div>
                    <div className="lb-bar">
                      <span
                        className={pctClass(row.achievementPct)}
                        style={{ width: `${Math.min(100, Math.round((row.actual.totalActivities / maxActivities) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className="lb-row-num">
                    {fmt(row.actual.totalActivities)}{row.target.totalActivities ? <small> / {fmt(row.target.totalActivities)}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="lb-item-sub">Bu hafta henüz aktivite girilmedi.</div>}
        </div>
        <div className="lb-card">
          <div className="lb-card-head"><h3>En Yakın Çözüm Tarihleri</h3><span>tüm portföy</span></div>
          <FollowupList rows={team.followups.soonest} empty="Açık takip yok." />
        </div>
      </div>
    </div>
  );
}

function OwnerSlide({ owner, todayKey }: { owner: LiveOwner; todayKey: string }) {
  return (
    <div className="lb-slide" key={owner.owner}>
      <div className="lb-person">
        <div className="lb-profile">
          <div className="lb-avatar">
            {owner.initials}
            <span className={`lb-rank-badge r${owner.rank}`} aria-label={`Sıra ${owner.rank}`}>#{owner.rank}</span>
          </div>
          <div className="lb-name">{owner.owner}<small>Bu haftanın performansı</small></div>
          <Ring actual={owner.actual.totalActivities} target={owner.target.totalActivities} />
          <div className="lb-mini">
            <div><strong>{fmt(owner.actual.uniqueCustomers)}</strong><span>Tekil Firma</span></div>
            <div><strong>{fmt(owner.todayActivities)}</strong><span>Bugün</span></div>
            <div><strong>{fmt(owner.quotes.count)}</strong><span>Teklif</span></div>
          </div>
          <div className="lb-mini-title">Takip Durumu</div>
          <div className="lb-mini">
            <div><strong>{fmt(owner.followups.open)}</strong><span>Açık Takip</span></div>
            <div><strong style={owner.followups.overdue ? { color: 'var(--lb-danger)' } : undefined}>{fmt(owner.followups.overdue)}</strong><span>Tarihi Geçen</span></div>
            <div><strong>{fmt(owner.followups.nearTermQuantity)}</strong><span>Yakın Vade Adet</span></div>
          </div>
        </div>

        <div className="lb-stack">
          <div className="lb-card">
            <div className="lb-card-head"><h3>Kanal Kırılımı</h3><span>gerçekleşen / hedef</span></div>
            <div className="lb-channels">
              {WEEKLY_TARGET_LABELS.map(({ key, label }) => (
                <div className="lb-channel" key={key}>
                  <div className="lb-channel-label">{label}</div>
                  <Bar actual={owner.actual[key]} target={owner.target[key]} />
                  <div className="lb-channel-num">
                    {fmt(owner.actual[key])}{owner.target[key] ? <small> / {fmt(owner.target[key])}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lb-card">
            <div className="lb-card-head"><h3>Son Hareketler</h3><span>bu hafta</span></div>
            <ActivityList rows={owner.recentActivities} todayKey={todayKey} />
          </div>
        </div>

        <div className="lb-card">
          <div className="lb-card-head"><h3>Takip Listesi</h3><span>en yakın {owner.followups.top.length}</span></div>
          <FollowupList rows={owner.followups.top} empty="Açık engeli yok." />
        </div>
      </div>
    </div>
  );
}

/* --- Pano ---------------------------------------------------------------- */

export default function LiveBoard({ active }: { active: boolean }) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<LiveBoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);          // ilerleme çubuğunu yeniden başlatmak için
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<LiveBoardSpeed>('normal');
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hideTimer = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);

  const plan = useMemo<LiveSlide[]>(() => slidePlan(data?.owners.length ?? 0), [data?.owners.length]);
  const current = plan[Math.min(index, plan.length - 1)] ?? { type: 'overview' as const };
  const durationMs = slideDurationMs(current, speed);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/live-board', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Canlı ekran verisi alınamadı.');
      setData(json as LiveBoardPayload);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Canlı ekran verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Hız tercihi
  useEffect(() => { setSpeed(readSpeed()); }, []);
  const changeSpeed = (value: LiveBoardSpeed) => {
    setSpeed(value);
    try { localStorage.setItem(SPEED_KEY, value); } catch {}
    setCycle((value) => value + 1);
  };

  // Veri: ilk yük + periyodik yenileme + sekme görünür olunca yenileme
  useEffect(() => {
    if (!active) return;
    void load();
    const timer = window.setInterval(() => void load(), LIVE_BOARD_TIMING.refreshMs);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, load]);

  // Saat
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  // Slayt zamanlayıcısı
  const goTo = useCallback((next: number) => {
    const total = Math.max(1, plan.length);
    setIndex(((next % total) + total) % total);
    setCycle((value) => value + 1);
  }, [plan.length]);
  const step = useCallback((delta: number) => {
    setIndex((value) => {
      const total = Math.max(1, plan.length);
      return ((value + delta) % total + total) % total;
    });
    setCycle((value) => value + 1);
  }, [plan.length]);

  // Zamanlayıcı yalnız slayt/hız/duraklatma değişince yeniden kurulur; 5 dakikalık
  // veri yenilemesi (data nesnesi değişir) akan slaytı ve ilerleme çubuğunu bozmaz.
  const hasData = Boolean(data);
  useEffect(() => {
    if (!active || paused || !hasData) return;
    const timer = window.setTimeout(() => step(1), durationMs);
    return () => window.clearTimeout(timer);
  }, [active, paused, hasData, index, cycle, durationMs, step]);

  // Plan kısalırsa (kişi azaldı) indeksi güvenli tut
  useEffect(() => {
    if (index >= plan.length) setIndex(0);
  }, [plan.length, index]);

  // Tam ekran durumu
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === boardRef.current));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const node = boardRef.current;
    if (!node) return;
    if (document.fullscreenElement) { void document.exitFullscreen?.(); return; }
    void node.requestFullscreen?.().catch(() => {});
  }, []);

  // Ekran uyanık kalsın (destekleyen tarayıcılarda)
  useEffect(() => {
    if (!active) return;
    const request = async () => {
      try {
        const api = (navigator as any).wakeLock;
        if (!api?.request) return;
        wakeLock.current = await api.request('screen');
      } catch {}
    };
    void request();
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { wakeLock.current?.release?.(); } catch {}
      wakeLock.current = null;
    };
  }, [active]);

  // Klavye
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (event.key === ' ') { event.preventDefault(); setPaused((value) => !value); }
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'f' || event.key === 'F') toggleFullscreen();
      else if (event.key === 'r' || event.key === 'R') void load();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, toggleFullscreen, load]);

  // Kontroller fare hareketiyle görünür, sonra gizlenir (yalnız tam ekranda gizle)
  const poke = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);
  const controlsHidden = fullscreen && !controlsVisible && !paused;

  const title = current.type === 'overview'
    ? { main: 'Takım Özeti', sub: data ? `${data.team.ownerCount} kişi · ${data.range.label}` : '' }
    : { main: data?.owners[current.index]?.owner ?? '', sub: `Sıra #${data?.owners[current.index]?.rank ?? ''} · ${data?.range.label ?? ''}` };

  return (
    <section
      ref={boardRef}
      className="lb"
      onMouseMove={poke}
      onClick={poke}
      aria-label="Canlı ekran"
      aria-live="polite"
    >
      <div className="lb-top">
        <div className="lb-brand">
          <span className="lb-eyebrow">Canlı Ekran · Satışçı Takip</span>
          <span className="lb-range">{data ? `Hafta: ${data.range.label}` : 'Yükleniyor…'}</span>
        </div>
        <div className="lb-title">{title.main}<small>{title.sub}</small></div>
        <div className="lb-meta">
          <div className={`lb-controls ${controlsHidden ? 'hidden' : ''}`}>
            <button type="button" className="lb-ctl" onClick={() => step(-1)} aria-label="Önceki slayt" title="Önceki (←)">‹</button>
            <button type="button" className={`lb-ctl ${paused ? 'on' : ''}`} onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Devam et' : 'Duraklat'} title="Duraklat / devam (Boşluk)">
              {paused ? '▶ Devam' : '❚❚'}
            </button>
            <button type="button" className="lb-ctl" onClick={() => step(1)} aria-label="Sonraki slayt" title="Sonraki (→)">›</button>
            <select className="lb-speed" value={speed} onChange={(event) => changeSpeed(event.target.value as LiveBoardSpeed)} aria-label="Slayt hızı" title="Slayt hızı">
              {(Object.keys(LIVE_BOARD_SPEEDS) as LiveBoardSpeed[]).map((key) => (
                <option key={key} value={key}>{LIVE_BOARD_SPEEDS[key].label}</option>
              ))}
            </select>
            <button type="button" className="lb-ctl" onClick={() => void load()} aria-label="Veriyi yenile" title="Yenile (R)">↻</button>
            <button type="button" className={`lb-ctl ${fullscreen ? 'on' : ''}`} onClick={toggleFullscreen} aria-label="Tam ekran" title="Tam ekran (F)">
              {fullscreen ? 'Çık' : '⛶ Tam ekran'}
            </button>
          </div>
          <div className="lb-clock">
            {fmtClock(now)}
            <small>{updatedAt ? `Güncellendi ${fmtClock(updatedAt)}` : ''}</small>
          </div>
        </div>
      </div>

      <div className={`lb-progress ${paused ? 'paused' : ''}`} aria-hidden="true">
        <i key={`${index}-${cycle}-${speed}`} style={{ animationDuration: `${durationMs}ms` }} />
      </div>

      <div className="lb-body">
        {loading && !data ? (
          <div className="lb-empty"><div><strong>Canlı ekran hazırlanıyor…</strong>Haftanın aktiviteleri, hedefler ve açık takipler yükleniyor.</div></div>
        ) : error && !data ? (
          <div className="lb-empty"><div><strong>Veri alınamadı</strong>{error}</div></div>
        ) : data ? (
          current.type === 'overview'
            ? <OverviewSlide data={data} />
            : data.owners[current.index]
              ? <OwnerSlide owner={data.owners[current.index]} todayKey={data.range.today} />
              : <OverviewSlide data={data} />
        ) : null}
      </div>

      {data ? (
        <div className={`lb-strip ${controlsHidden ? 'lb-controls hidden' : ''}`}>
          {plan.map((slide, slideIndex) => (
            <button
              type="button"
              key={`${slide.type}-${slide.type === 'owner' ? slide.index : slideIndex}`}
              className={`lb-dot ${slide.type === 'overview' ? 'overview' : ''} ${slideIndex === index ? 'active' : ''}`}
              onClick={() => goTo(slideIndex)}
              title={slide.type === 'overview' ? 'Takım Özeti' : data.owners[slide.index]?.owner}
              aria-label={slide.type === 'overview' ? 'Takım Özeti' : data.owners[slide.index]?.owner}
            >
              {slide.type === 'overview' ? 'ÖZET' : data.owners[slide.index]?.initials}
            </button>
          ))}
          <span className="lb-strip-note">
            <span className="lb-kbd">Boşluk</span> duraklat · <span className="lb-kbd">←</span><span className="lb-kbd">→</span> gezin · <span className="lb-kbd">F</span> tam ekran
            {error ? ` · son yenileme başarısız: ${error}` : ''}
          </span>
        </div>
      ) : null}
    </section>
  );
}
