import { describe, expect, it } from 'vitest';
import {
  normalizeName,
  ALERT_ORDER,
  LIVE_BOARD_TIMING,
  OWNER_ORDER,
  SECTOR_ORDER,
  orderDistribution,
  ownerOrderCompare,
  agoLabel,
  alertPanels,
  capacities,
  layoutMetrics,
  ownerDonutRowHeight,
  BASE_METRICS,
  COMPACT_METRICS,
  pageBounds,
  pageCount,
  pageSlice,
  perPage,
  rowsThatFit,
  dayDiff,
  dueLabel,
  dueTone,
  fmtMoney,
  initialsOf,
  istanbulDayKey,
  paceTone,
  pctOf,
  conversionPct,
  conversionTone,
  unknownCompanyRank,
  phaseGroupOf,
  rankOwners,
  slideDurationMs,
  slidePlan,
  staleTone,
  teamRollup,
  weekRangeLabel,
  yearElapsedPct,
} from './live-board-shared';
import { emptyWeeklyCounters } from './weekly-targets-shared';
import type { LiveOwner } from './live-board-shared';

describe('initialsOf', () => {
  it('takes first letters of first and last name, Turkish-uppercased', () => {
    expect(initialsOf('Ömer Canatar')).toBe('ÖC');
    expect(initialsOf('seda kesikoğlu')).toBe('SK');
    expect(initialsOf('ismail yıldız')).toBe('İY');
  });
  it('handles single names and blanks', () => {
    expect(initialsOf('Furkan')).toBe('FU');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('rankOwners', () => {
  const counters = (total: number, unique: number) => ({ ...emptyWeeklyCounters(), totalActivities: total, uniqueCustomers: unique });
  it('ranks by revenue attainment first, then activities, unique customers and name', () => {
    const ranked = rankOwners([
      { owner: 'Zeynep', actual: counters(5, 2), revenue: { attainmentPct: null } },
      { owner: 'Ahmet', actual: counters(5, 2), revenue: { attainmentPct: null } },
      { owner: 'Mert', actual: counters(9, 1), revenue: { attainmentPct: 40 } },
      { owner: 'Ece', actual: counters(5, 4), revenue: { attainmentPct: 65 } },
    ]);
    expect(ranked.map((row) => `${row.rank}:${row.owner}`)).toEqual(['1:Ece', '2:Mert', '3:Ahmet', '4:Zeynep']);
  });
  it('falls back to activity ranking when nobody has a revenue target', () => {
    const ranked = rankOwners([
      { owner: 'Zeynep', actual: counters(5, 2) },
      { owner: 'Mert', actual: counters(9, 1) },
      { owner: 'Ece', actual: counters(5, 4) },
    ]);
    expect(ranked.map((row) => row.owner)).toEqual(['Mert', 'Ece', 'Zeynep']);
  });
});

describe('sabit görüntüleme sırası (Çağdaş Bey, 04.09)', () => {
  it('kişileri sabit sıraya dizer, liste dışı adlar sona alfabetik', () => {
    const names = ['Yemek Kartları', 'Furkan Kızılkurt', 'Zeynep Test', 'Cem Koç', 'Havuz Account', 'Ahmet Test', 'Seda Kesikoğlu', 'Ömer Canatar', 'İş Ortakları', 'Erdi Toraman'];
    expect([...names].sort(ownerOrderCompare)).toEqual([
      'Cem Koç', 'Ömer Canatar', 'Furkan Kızılkurt', 'Erdi Toraman', 'Seda Kesikoğlu', 'İş Ortakları', 'Havuz Account', 'Yemek Kartları',
      'Ahmet Test', 'Zeynep Test',
    ]);
    expect(OWNER_ORDER[0]).toBe('Cem Koç');
  });
  it('büyük/küçük harf ve fazla boşluk sıralamayı bozmaz', () => {
    expect(['furkan  kızılkurt', 'CEM KOÇ'].sort(ownerOrderCompare)).toEqual(['CEM KOÇ', 'furkan  kızılkurt']);
  });
  it('sektörleri önce sabit sıraya, kalanı adede göre dizer', () => {
    const rows = [
      { label: 'FMCG Dağıtım Kanalları', value: 116 }, { label: 'Lojistik & Kargo', value: 5 }, { label: 'Ev & Yaşam / Yapı Market', value: 39 },
      { label: 'Hazır Giyim', value: 89 }, { label: 'Yeme-İçme', value: 6 }, { label: 'Gıda Perakendesi', value: 48 },
    ];
    expect(orderDistribution(rows, SECTOR_ORDER).map((r) => r.label)).toEqual([
      'Hazır Giyim', 'Gıda Perakendesi', 'Ev & Yaşam / Yapı Market', 'FMCG Dağıtım Kanalları', 'Yeme-İçme', 'Lojistik & Kargo',
    ]);
  });
});

describe('slidePlan', () => {
  const show = (plan: ReturnType<typeof slidePlan>) => plan
    .map((s) => (s.type === 'team' ? s.key : `#${s.index}`) + (s.pages > 1 ? `(${s.page + 1}/${s.pages})` : ''))
    .join(' ');
  it('keeps the fixed order: Özet, everybody, quotes, alerts, portfolio, pools (Yemek Kartları & Havuz, 17.09), Jira, hot, POC', () => {
    // Çağdaş Bey, 15.09: Özet → Kişiler → Teklifler → Uyarı → Portföy → [Faz] → Jira →
    // Hot Pipeline → POC. Hot ve POC 09.09'da rotasyondan çıkmıştı, sona eklenerek döndü.
    expect(show(slidePlan(5))).toBe('pulse #0 #1 #2 #3 #4 quotes alerts portfolio pools hot poc');
  });
  it('shows only the team screens when there is nobody to show', () => {
    expect(show(slidePlan(0))).toBe('pulse quotes alerts portfolio pools hot poc');
  });
  it('puts Hot Pipeline and POC at the very end, after Jira', () => {
    expect(show(slidePlan(3, { jira: true }))).toBe('pulse #0 #1 #2 quotes alerts portfolio pools jira hot poc');
  });
  it('adds the Jira screen only when the integration is on', () => {
    expect(show(slidePlan(0, { jira: true }))).toContain('jira');
    expect(show(slidePlan(0))).not.toContain('jira');
  });
  it('expands a screen that needs more than one page into consecutive slides', () => {
    const plan = slidePlan(2, { pages: { team: { portfolio: 2, quotes: 3 }, owners: [2, 1] } });
    expect(show(plan)).toBe('pulse #0(1/2) #0(2/2) #1 quotes(1/3) quotes(2/3) quotes(3/3) alerts portfolio(1/2) portfolio(2/2) pools hot poc');
  });
  it('gives team screens more time than a person slide and scales with speed', () => {
    expect(slideDurationMs({ type: 'team', key: 'pulse', page: 0, pages: 1 })).toBe(LIVE_BOARD_TIMING.teamMs);
    expect(slideDurationMs({ type: 'owner', index: 0, page: 0, pages: 1 })).toBe(LIVE_BOARD_TIMING.ownerMs);
    expect(slideDurationMs({ type: 'owner', index: 0, page: 0, pages: 1 }, 'fast')).toBeLessThan(LIVE_BOARD_TIMING.ownerMs);
    expect(slideDurationMs({ type: 'owner', index: 0, page: 0, pages: 1 }, 'slow')).toBeGreaterThan(LIVE_BOARD_TIMING.ownerMs);
  });
});

describe('sayfalama (taşma yerine devam slaydı)', () => {
  it('kaç satır sığdığını yüksekliğe göre hesaplar', () => {
    expect(rowsThatFit(300, 60, 10)).toBe(4);   // 4×60 + 3×10 = 270 ≤ 300
    expect(rowsThatFit(60, 60, 10)).toBe(1);
    expect(rowsThatFit(10, 60, 10)).toBe(1);    // en az bir satır
  });
  it('sayfa dilimi ve sayfa sayısı tutarlı', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7];
    expect(pageCount(rows.length, 3)).toBe(3);
    expect(pageSlice(rows, 0, 3)).toEqual([1, 2, 3]);
    expect(pageSlice(rows, 2, 3)).toEqual([7]);
    expect(pageSlice(rows, 5, 3)).toEqual([]);
    expect(pageCount(0, 3)).toBe(1);
  });
  it('satırları sayfalara dengeli dağıtır (son sayfa yarı boş kalmaz)', () => {
    const rows = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(pageCount(rows.length, 8)).toBe(3);
    expect(perPage(rows.length, 8)).toBe(7);              // 8+8+4 değil → 7+7+6
    expect([0, 1, 2].map((p) => pageSlice(rows, p, 8).length)).toEqual([7, 7, 6]);
    // hiçbir satır kaybolmaz, tekrar etmez
    const seen = [0, 1, 2].flatMap((p) => pageSlice(rows, p, 8));
    expect(seen).toEqual(rows);
    // kapasitenin üstüne çıkmaz → taşma imkânsız
    expect(perPage(rows.length, 8)).toBeLessThanOrEqual(8);
    expect(pageBounds(20, 1, 8)).toMatchObject({ from: 8, to: 14, paged: true });
    expect(pageBounds(5, 0, 8)).toMatchObject({ from: 1, to: 5, paged: false });
  });
  it('küçük ekranda daha az, büyük ekranda daha çok satır sığar', () => {
    const small = capacities(700, 1366);
    const big = capacities(1000, 1920);
    expect(big.tableRows).toBeGreaterThan(small.tableRows);
    expect(big.hot).toBeGreaterThanOrEqual(small.hot);
    expect(small.alertGroups).toBeLessThanOrEqual(big.alertGroups);
    for (const value of Object.values(small)) {
      if (typeof value === 'number') expect(value).toBeGreaterThanOrEqual(1);
    }
  });
  // 18.09: sıralama kartının altına Yemek Kartları / Havuz şeridi girdi — bütçesi kapasiteden düşer,
  // 1920×1080 gövdesinde (≈ 900) BEŞ satışçı tek sayfada kalır, şerit yerini alır (eskiden 6 sığardı).
  it('sıralama kapasitesi havuz şeridinin bütçesini düşer; 5 kişi tek sayfada kalır', () => {
    expect(capacities(900, 1920).leader).toBe(5);
    expect(capacities(700, 1366).leader).toBeGreaterThanOrEqual(3);
  });
  it('uyarıları türe göre panellere böler, hiçbirini gizlemez', () => {
    const mk = (kind: any, n: number) => Array.from({ length: n }, (_, i) => ({ kind, title: `${kind}-${i}`, detail: '', owner: null, days: null, tone: 'warn' as const }));
    const alerts = [...mk('overdue', 5), ...mk('stale', 2)];
    const counts = { stale: 2, overdue: 5, target_gap: 0, poc_delay: 0, customer_waiting: 0, contract_waiting: 0, expired_quote: 0, portfolio_load: 0 };
    const panels = alertPanels(alerts, counts, 2, ALERT_ORDER);
    expect(panels.map((p) => `${p.kind} ${p.part + 1}/${p.parts} (${p.rows.length})`)).toEqual([
      'overdue 1/3 (2)', 'overdue 2/3 (2)', 'overdue 3/3 (1)', 'stale 1/1 (2)',
    ]);
    expect(panels.reduce((sum, p) => sum + p.rows.length, 0)).toBe(alerts.length);
  });
});

describe('istanbulDayKey', () => {
  it('uses Istanbul local date even when the UTC date differs', () => {
    // 23:30 UTC on 1 Sep = 02:30 on 2 Sep in Istanbul (UTC+3)
    expect(istanbulDayKey(new Date('2026-09-01T23:30:00Z'))).toBe('2026-09-02');
  });
  it('returns empty for invalid dates', () => {
    expect(istanbulDayKey('not-a-date')).toBe('');
  });
});

describe('weekRangeLabel', () => {
  it('collapses the month when both ends share it', () => {
    expect(weekRangeLabel('2026-09-07', '2026-09-13')).toBe('07–13 Eyl 2026');
  });
  it('spells both months across a month boundary', () => {
    expect(weekRangeLabel('2026-08-31', '2026-09-06')).toBe('31 Ağu – 06 Eyl 2026');
  });
});

describe('date rules', () => {
  it('computes day differences and due/ago labels the way a manager reads them', () => {
    expect(dayDiff('2026-09-04', '2026-09-14')).toBe(10);
    expect(dayDiff('2026-09-04', '2026-08-30')).toBe(-5);
    expect(dueLabel(10)).toBe('10 gün kaldı');
    expect(dueLabel(-5)).toBe('5 gün gecikti');
    expect(dueLabel(0)).toBe('bugün');
    expect(dueLabel(null)).toBe('tarih yok');
    expect(agoLabel(4)).toBe('4 gün önce');
    expect(agoLabel(0)).toBe('bugün');
  });
  it('colours due dates and stale opportunities per the spec thresholds', () => {
    expect(dueTone(-1)).toBe('danger');
    expect(dueTone(3)).toBe('warn');
    expect(dueTone(30)).toBe('ok');
    expect(staleTone(6)).toBe('ok');
    expect(staleTone(7)).toBe('warn');
    expect(staleTone(14)).toBe('danger');
    expect(staleTone(null)).toBe('neutral');
  });
  it('compares revenue pace with the elapsed share of the year', () => {
    expect(yearElapsedPct('2026-01-01')).toBe(0);
    expect(yearElapsedPct('2026-07-02')).toBeGreaterThanOrEqual(49);
    expect(yearElapsedPct('2026-07-02')).toBeLessThanOrEqual(51);
    expect(paceTone(70, 67)).toBe('ok');
    expect(paceTone(60, 67)).toBe('warn');
    expect(paceTone(50, 67)).toBe('danger');
    expect(paceTone(null, 67)).toBeNull();
  });
});

describe('numbers', () => {
  it('formats USD compactly for a TV', () => {
    expect(fmtMoney(1_120_000)).toBe('$1,12M');
    expect(fmtMoney(82_000)).toBe('$82K');
    expect(fmtMoney(950)).toBe('$950');
    expect(fmtMoney(-70_000)).toBe('−$70K');
    expect(fmtMoney(70_000, { sign: true })).toBe('+$70K');
    expect(fmtMoney(null)).toBe('—');
  });
  it('returns null percentages when there is no target', () => {
    expect(pctOf(50, 200)).toBe(25);
    expect(pctOf(50, 0)).toBeNull();
    expect(pctOf(50, null)).toBeNull();
  });
  it('computes quote → sale conversion only when quotes actually closed', () => {
    // 6 satış · 1 iptal · 3 kayıp = 10 kapanan → %60.
    expect(conversionPct(6, 1, 3)).toBe(60);
    // İptal edilen satış dönüşümü düşürür (ciro da düşmüştü).
    expect(conversionPct(0, 2, 0)).toBe(0);
    // Hiç kapanan teklif yoksa "%0" değil "—".
    expect(conversionPct(0, 0, 0)).toBeNull();
    expect(conversionTone(null)).toBe('neutral');
    expect(conversionTone(60)).toBe('ok');
    expect(conversionTone(30)).toBe('warn');
    expect(conversionTone(10)).toBe('danger');
  });
  it('pushes unknown Jira companies to the end of the list', () => {
    // Sinan, 09.09: "Jira kısmında bilinmeyen firma en sona".
    expect(unknownCompanyRank('BOYNER')).toBe(0);
    expect(unknownCompanyRank('Bilinmeyen Firma')).toBe(1);
    expect(unknownCompanyRank('bilinmeyen')).toBe(1);
    expect(unknownCompanyRank('—')).toBe(1);
    expect(unknownCompanyRank('')).toBe(1);
    expect(unknownCompanyRank(null)).toBe(1);
    const rows = ['Bilinmeyen Firma', 'A101', '—', 'BOYNER'];
    expect([...rows].sort((a, b) => unknownCompanyRank(a) - unknownCompanyRank(b) || a.localeCompare(b, 'tr')))
      .toEqual(['A101', 'BOYNER', '—', 'Bilinmeyen Firma']);   // tr sıralaması: '—' önce
  });
  it('maps phases to display groups', () => {
    expect(phaseGroupOf(null)).toBe('none');
    expect(phaseGroupOf(2)).toBe('lead');
    expect(phaseGroupOf(10)).toBe('quote');
    expect(phaseGroupOf(12)).toBe('poc');
    expect(phaseGroupOf(15)).toBe('order');
    expect(phaseGroupOf(24)).toBe('rollout');
  });
});

describe('Müşteri Listesi eşlemesi — kişi adı anahtarı', () => {
  it('OWNER_ORDER yazımı ile listedeki farklı yazımlar aynı anahtara düşer', () => {
    expect(normalizeName('Furkan Kızılkurt')).toBe(normalizeName('FURKAN  KIZILKURT'));
    expect(normalizeName('Ömer Canatar')).toBe(normalizeName('ömer canatar'));
    expect(normalizeName('Erdi Toraman')).not.toBe(normalizeName('Seda Kesikoğlu'));
  });
});

describe('kişi slaydı donut satırı — gövdeyle orantılı (v3.0, 14.09)', () => {
  it('bant düşüldükten sonra kalanın %46\'sı; 240–560 px arasında', () => {
    // 1920×1080 tam ekran: gövde ≈ 1037 → (1037 − 84 − 14) × 0.46 ≈ 432
    expect(ownerDonutRowHeight(1037, BASE_METRICS)).toBe(432);
    // 1366×768 kompakt: gövde ≈ 729 → (729 − 76 − 12) × 0.46 ≈ 295
    expect(ownerDonutRowHeight(729, COMPACT_METRICS)).toBe(295);
    expect(ownerDonutRowHeight(300, COMPACT_METRICS)).toBe(240);   // alt sınır
    expect(ownerDonutRowHeight(5000, BASE_METRICS)).toBe(560);     // üst sınır
  });
  it('gövde ölçülmeden (0) taban ölçü döner; layoutMetrics orantılı değeri taşır', () => {
    expect(ownerDonutRowHeight(0, BASE_METRICS)).toBe(BASE_METRICS.donutRowH);
    expect(layoutMetrics(1037).donutRowH).toBe(432);
    expect(layoutMetrics(729).compact).toBe(true);
    expect(layoutMetrics(729).donutRowH).toBe(295);
  });
});


/* ------------------------------------------------------------------------ */
/* ÖZET slaydı — takım toplamı (v3.2, Çağdaş Bey 15.09)                      */
/* ------------------------------------------------------------------------ */

describe('teamRollup — Özet slaydının sol tarafı', () => {
  const pair = (actual: number, target: number | null) => ({
    actual, target, pct: target == null ? null : Math.round((actual / target) * 100),
  });
  /** Yalnız teamRollup'ın okuduğu alanlar; kalanı ekranın işi. */
  const owner = (over: {
    visits?: [number, number | null];
    budget?: [number, number | null];
    integration?: [number, number | null];
    month?: [number, number | null];
    pending?: boolean;
    list?: { hunter: number; farmer: number; lead: number; kasa: number } | null;
    open?: [number, number];
    devices?: [number, number, number];
    monthDevices?: number;
    revenue?: { usdMonth: number; usdYear: number; otherMonth: number; otherYear: number };
    poc?: number;
    invoices?: number;
    covered?: [number, number | null];
    contactsTarget?: number | null;
    activitiesYear?: number;
    inactive?: [number, number];
    portfolio?: [number, number];
  }) => ({
    goals: {
      quarter: { label: 'Ç3', months: 'Tem–Eyl', elapsedPct: 60 },
      visitsQuarter: pair(...(over.visits ?? [0, null] as [number, number | null])),
      visitsYear: pair(0, null),
      budgetQuarter: pair(...(over.budget ?? [0, null] as [number, number | null])),
      integration: pair(...(over.integration ?? [0, null] as [number, number | null])),
      integrationQuarter: pair(0, null),
      integrationMonth: pair(...(over.month ?? [0, null] as [number, number | null])),
      integrationMonthDevices: over.monthDevices ?? 0,
      integrationRevenue: over.revenue ?? { usdMonth: 0, usdYear: 0, otherMonth: 0, otherYear: 0 },
      integrationMonthLabel: 'Eylül',
      integrationMonthElapsedPct: 57,
      integrationPending: over.pending ?? false,
      hunterToFarmer: pair(0, null),
      leadToHunter: pair(0, null),
    },
    list: over.list ? { ...over.list, total: over.list.hunter + over.list.farmer + over.list.lead + over.list.kasa } : null,
    quoteBox: {
      open: { count: over.open?.[0] ?? 0, amount: over.open?.[1] ?? 0 },
      won: { count: 0, amount: 0 },
      lost: { count: 0, amount: 0 },
    },
    devices: { total: over.devices?.[0] ?? 0, sold: over.devices?.[1] ?? 0, rental: over.devices?.[2] ?? 0 },
    pipeline: { poc: over.poc ?? 0 },
    invoices: over.invoices ?? 0,
    coverage: {
      covered: pair(...(over.covered ?? [0, null] as [number, number | null])),
      contactsPer: pair(0, over.contactsTarget ?? null),
      activitiesYear: over.activitiesYear ?? 0,
    },
    inactive: { count: over.inactive?.[0] ?? 0, days: 15, unmatched: over.inactive?.[1] ?? 0 },
    portfolio: { total: over.portfolio?.[0] ?? 0, active: over.portfolio?.[1] ?? 0 },
  }) as unknown as LiveOwner;

  it('sayıları ve tutarları toplar, yüzdeyi yeniden hesaplar', () => {
    const rollup = teamRollup([
      owner({ visits: [6, 10], open: [3, 1500], devices: [10, 6, 4], poc: 1, invoices: 2, portfolio: [40, 30] }),
      owner({ visits: [9, 10], open: [2, 500], devices: [5, 5, 0], poc: 2, invoices: 3, portfolio: [20, 11] }),
    ]);
    expect(rollup.owners).toBe(2);
    expect(rollup.visitsQuarter).toEqual({ actual: 15, target: 20, pct: 75 });
    expect(rollup.quoteBox.open).toEqual({ count: 5, amount: 2000 });
    expect(rollup.devices).toEqual({ total: 15, sold: 11, rental: 4 });
    expect(rollup.poc).toBe(3);
    expect(rollup.invoices).toBe(5);
    expect(rollup.portfolio).toEqual({ total: 60, active: 41 });
  });

  it('hedefi olmayan kişi toplam hedefi düşürmez; hiç hedef yoksa "hedef yok"', () => {
    const some = teamRollup([owner({ budget: [100, 400] }), owner({ budget: [50, null] })]);
    expect(some.budgetQuarter).toEqual({ actual: 150, target: 400, pct: 38 });
    const none = teamRollup([owner({ budget: [100, null] }), owner({ budget: [50, null] })]);
    expect(none.budgetQuarter.target).toBeNull();
    expect(none.budgetQuarter.pct).toBeNull();
  });

  // 18.09 (Sinan): kümülatif entegrasyon — ayın adedi ve kazanılan para kişi kişi toplanır; TL ayrı kalır.
  it('entegrasyon: ayın cihaz adedi ve kazanılan para toplanır, USD ile TL karışmaz', () => {
    const rollup = teamRollup([
      owner({ month: [1000, 1500], monthDevices: 270, revenue: { usdMonth: 12_000, usdYear: 90_000, otherMonth: 0, otherYear: 0 } }),
      owner({ month: [371, 900], monthDevices: 40, revenue: { usdMonth: 3_000, usdYear: 20_000, otherMonth: 500, otherYear: 4_500 } }),
    ]);
    expect(rollup.integrationMonth).toEqual({ actual: 1371, target: 2400, pct: 57 });
    expect(rollup.integrationMonthDevices).toBe(310);
    expect(rollup.integrationRevenue).toEqual({ usdMonth: 15_000, usdYear: 110_000, otherMonth: 500, otherYear: 4_500 });
  });

  it('ortalama temas toplanmaz, toplam görüşme / toplam kapsanan firmadan yeniden bölünür', () => {
    // Ortak hedef (033) kişilerde aynı değerdir: toplanmaz, aynen kalır.
    const rollup = teamRollup([
      owner({ covered: [20, 30], activitiesYear: 100, contactsTarget: 5 }),
      owner({ covered: [30, 30], activitiesYear: 125, contactsTarget: 5 }),
    ]);
    expect(rollup.coverage.covered).toEqual({ actual: 50, target: 60, pct: 83 });
    expect(rollup.coverage.contactsPer.actual).toBe(4.5);
    expect(rollup.coverage.contactsPer.target).toBe(5);
  });

  it('Müşteri Listesi toplanır; hiç kimsede liste yoksa null kalır', () => {
    const withList = teamRollup([
      owner({ list: { hunter: 10, farmer: 4, lead: 2, kasa: 1 } }),
      owner({ list: null }),
    ]);
    expect(withList.list).toEqual({ hunter: 10, farmer: 4, lead: 2, kasa: 1, total: 17 });
    expect(teamRollup([owner({ list: null })]).list).toBeNull();
  });

  it('tek kişi bile entegrasyon verisini bekliyorsa takım toplamı da bekler', () => {
    expect(teamRollup([owner({ pending: false }), owner({ pending: true })]).integrationPending).toBe(true);
    expect(teamRollup([owner({ pending: false })]).integrationPending).toBe(false);
  });

  it('kişi yoksa çökmeden boş toplam döner', () => {
    const empty = teamRollup([]);
    expect(empty.owners).toBe(0);
    expect(empty.quarter).toBeNull();
    expect(empty.coverage.contactsPer.actual).toBe(0);
    expect(empty.inactive.days).toBe(15);
  });
});
