import { describe, expect, it } from 'vitest';
import {
  ALERT_ORDER,
  LIVE_BOARD_TIMING,
  agoLabel,
  alertPanels,
  capacities,
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
  phaseGroupOf,
  rankOwners,
  slideDurationMs,
  slidePlan,
  staleTone,
  weekRangeLabel,
  yearElapsedPct,
} from './live-board-shared';
import { emptyWeeklyCounters } from './weekly-targets-shared';

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

describe('slidePlan', () => {
  const show = (plan: ReturnType<typeof slidePlan>) => plan
    .map((s) => (s.type === 'team' ? s.key : `#${s.index}`) + (s.pages > 1 ? `(${s.page + 1}/${s.pages})` : ''))
    .join(' ');
  it('alternates two team screens with two people until both run out', () => {
    expect(show(slidePlan(5))).toBe('pulse portfolio #0 #1 hot poc #2 #3 quotes alerts #4');
  });
  it('shows only the team screens when there is nobody to show', () => {
    expect(show(slidePlan(0))).toBe('pulse portfolio hot poc quotes alerts');
  });
  it('adds the Jira screen only when the integration is on', () => {
    expect(show(slidePlan(0, { jira: true }))).toContain('jira');
    expect(show(slidePlan(0))).not.toContain('jira');
  });
  it('expands a screen that needs more than one page into consecutive slides', () => {
    const plan = slidePlan(2, { pages: { team: { hot: 3 }, owners: [2, 1] } });
    expect(show(plan)).toBe('pulse portfolio #0(1/2) #0(2/2) #1 hot(1/3) hot(2/3) hot(3/3) poc quotes alerts');
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
  it('uyarıları türe göre panellere böler, hiçbirini gizlemez', () => {
    const mk = (kind: any, n: number) => Array.from({ length: n }, (_, i) => ({ kind, title: `${kind}-${i}`, detail: '', owner: null, days: null, tone: 'warn' as const }));
    const alerts = [...mk('overdue', 5), ...mk('stale', 2)];
    const counts = { stale: 2, overdue: 5, target_gap: 0, poc_delay: 0, customer_waiting: 0, contract_waiting: 0, expired_quote: 0 };
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
  it('maps phases to display groups', () => {
    expect(phaseGroupOf(null)).toBe('none');
    expect(phaseGroupOf(2)).toBe('lead');
    expect(phaseGroupOf(10)).toBe('quote');
    expect(phaseGroupOf(12)).toBe('poc');
    expect(phaseGroupOf(15)).toBe('order');
    expect(phaseGroupOf(24)).toBe('rollout');
  });
});
