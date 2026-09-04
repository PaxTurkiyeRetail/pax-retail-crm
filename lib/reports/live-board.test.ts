import { describe, expect, it } from 'vitest';
import {
  LIVE_BOARD_TIMING,
  initialsOf,
  istanbulDayKey,
  rankOwners,
  slideDurationMs,
  slidePlan,
  weekRangeLabel,
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
  it('ranks by activities, then unique customers, then name', () => {
    const ranked = rankOwners([
      { owner: 'Zeynep', actual: counters(5, 2) },
      { owner: 'Ahmet', actual: counters(5, 2) },
      { owner: 'Mert', actual: counters(9, 1) },
      { owner: 'Ece', actual: counters(5, 4) },
    ]);
    expect(ranked.map((row) => `${row.rank}:${row.owner}`)).toEqual(['1:Mert', '2:Ece', '3:Ahmet', '4:Zeynep']);
  });
});

describe('slidePlan', () => {
  it('starts with the overview and revisits it every N owners', () => {
    const plan = slidePlan(6, 4);
    expect(plan.map((slide) => (slide.type === 'overview' ? 'O' : String(slide.index))).join(' ')).toBe('O 0 1 2 3 O 4 5');
  });
  it('shows only the overview when there is nobody to show', () => {
    expect(slidePlan(0)).toEqual([{ type: 'overview' }]);
  });
  it('gives the overview more time than a person slide and scales with speed', () => {
    expect(slideDurationMs({ type: 'overview' })).toBe(LIVE_BOARD_TIMING.overviewMs);
    expect(slideDurationMs({ type: 'owner', index: 0 })).toBe(LIVE_BOARD_TIMING.ownerMs);
    expect(slideDurationMs({ type: 'owner', index: 0 }, 'fast')).toBeLessThan(LIVE_BOARD_TIMING.ownerMs);
    expect(slideDurationMs({ type: 'owner', index: 0 }, 'slow')).toBeGreaterThan(LIVE_BOARD_TIMING.ownerMs);
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
