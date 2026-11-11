import { describe, expect, it } from 'vitest';
import { formatPeriodLabel, resolvePeriod } from '@/lib/filters/period';
import { activityDateRange, departmentClause, escapeLike, ownerIdClause, parsePhaseRange, phaseClause, searchClause, trFold } from '@/lib/filters/sql';
import { countActiveFilters, filtersToQuery, parseFilters, type PageFilterConfig } from '@/lib/filters/schema';

describe('period (Europe/Istanbul)', () => {
  it('this_week Pazartesi başlar', () => {
    // 2026-11-11 Çarşamba
    const r = resolvePeriod('this_week', new Date('2026-11-11T10:00:00Z'));
    expect(r).toMatchObject({ from: '2026-11-09', to: '2026-11-15', label: '09–15 Kas 2026' });
  });
  it('Pazar 21:30 UTC = Pazartesi İstanbul → yeni hafta', () => {
    const r = resolvePeriod('this_week', new Date('2026-11-15T21:30:00Z'));
    expect(r.from).toBe('2026-11-16');
  });
  it('Pazar 20:59 UTC hâlâ Pazar → eski hafta', () => {
    expect(resolvePeriod('this_week', new Date('2026-11-15T20:59:00Z')).from).toBe('2026-11-09');
  });
  it('last_week, month, quarter, year', () => {
    const now = new Date('2026-11-11T10:00:00Z');
    expect(resolvePeriod('last_week', now)).toMatchObject({ from: '2026-11-02', to: '2026-11-08' });
    expect(resolvePeriod('last_month', now)).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(resolvePeriod('this_quarter', now)).toMatchObject({ from: '2026-10-01', to: '2026-12-31' });
    expect(resolvePeriod('this_year', now).label).toBe('01 Oca – 31 Ara 2026');
  });
  it('custom geçerli/ters aralık', () => {
    expect(resolvePeriod({ period: 'custom', from: '2025-12-29', to: '2026-01-04' }).label).toBe('29 Ara 2025 – 04 Oca 2026');
    expect(resolvePeriod({ period: 'custom', from: '2026-02-10', to: '2026-02-01' }, new Date('2026-11-11T10:00:00Z')).preset).toBe('this_week');
  });
  it('label tek gün', () => expect(formatPeriodLabel('2026-11-11', '2026-11-11')).toBe('11 Kas 2026'));
});

describe('sql helpers', () => {
  it('activityDateRange to+1 exclusive', () => {
    const v: unknown[] = [];
    const sql = activityDateRange(v, '2026-11-09', '2026-11-15');
    expect(sql).toContain('>= $1::date');
    expect(sql).toContain('< ($2::date + 1)');
    expect(sql).toContain("coalesce(pe.aktivite_tarihi");
    expect(v).toEqual(['2026-11-09', '2026-11-15']);
  });
  it('phase range', () => {
    expect(parsePhaseRange('1-4')).toEqual({ min: 1, max: 4 });
    expect(parsePhaseRange('5')).toEqual({ min: 5, max: 5 });
    expect(parsePhaseRange('4-1')).toBeNull();
    expect(parsePhaseRange('abc')).toBeNull();
    expect(parsePhaseRange('1;drop')).toBeNull();
    const v: unknown[] = [];
    expect(phaseClause(v, '1-4')).toBe('m.faz between $1 and $2');
    expect(phaseClause([], 'x')).toBe('true');
  });
  it('Türkçe arama', () => {
    expect(trFold('İSTANBUL Çağrı Şişli Ömür Ğ')).toBe('istanbul cagri sisli omur g');
    expect(escapeLike('50%_a\\')).toBe('50\\%\\_a\\\\');
    const v: unknown[] = [];
    const sql = searchClause(v, '  Işık% ', ['m.unvan']);
    expect(v).toEqual(['%isik\\%%']);
    expect(sql).toContain("lower(translate(coalesce(m.unvan, ''), 'İIıŞşĞğÜüÖöÇç', 'iiissgguuoocc'))");
    expect(searchClause([], '', ['x'])).toBe('true');
  });
  it('departman kapsamı', () => {
    const v: unknown[] = [];
    expect(departmentClause(v, 'bank', null)).toBe('m.is_kolu = any($1::text[])');
    expect(v).toEqual([['Bank']]);
    const v2: unknown[] = [];
    departmentClause(v2, 'Bank', ['Retail']);
    expect(v2).toEqual([['Retail']]);
    expect(departmentClause([], undefined, null)).toBe('true');
  });
  it('ownerIdClause id ile', () => {
    const v: unknown[] = [];
    expect(ownerIdClause(v, 42)).toBe('pe.user_id = $1');
    expect(ownerIdClause([], '')).toBe('true');
  });
});

describe('parseFilters', () => {
  const config: PageFilterConfig = {
    keys: ['period', 'from', 'to', 'department', 'owner', 'phase', 'status', 'q'],
    defaults: { period: 'this_week' },
    options: { status: [{ value: 'open', label: 'Açık' }] },
  };
  it('geçersizleri düşürür, default uygular', () => {
    const f = parseFilters(new URLSearchParams('period=yesterday&department=Foo&owner=1;drop&phase=9-1&status=zzz&q=%20%20&from=2026-13-01'), config);
    expect(f).toEqual({ period: 'this_week' });
  });
  it('geçerlileri tipli döner', () => {
    const f = parseFilters({ period: 'this_month', department: 'Bank', owner: '42', phase: '1-4', status: 'open', q: ' Işık ' }, config);
    expect(f).toEqual({ period: 'this_month', department: 'Bank', owner: '42', phase: '1-4', status: 'open', q: 'Işık' });
  });
  it('from/to → custom; ters aralık düşer', () => {
    expect(parseFilters(new URLSearchParams('from=2026-11-01&to=2026-11-05'), config).period).toBe('custom');
    expect(parseFilters(new URLSearchParams('from=2026-11-05&to=2026-11-01'), config)).toEqual({ period: 'this_week' });
  });
  it('config dışı anahtar okunmaz', () => {
    expect(parseFilters(new URLSearchParams('role=admin'), config)).not.toHaveProperty('role');
  });
  it('departman izinleri', () => {
    expect(parseFilters(new URLSearchParams('department=Bank'), config, { allowedDepartments: ['Retail'] }).department).toBe('Retail');
    expect(parseFilters(new URLSearchParams('department=Vertical'), config, { allowedDepartments: ['Retail', 'Bank'] }).department).toBeUndefined();
    expect(parseFilters(new URLSearchParams('department=Bank'), config, { allowedDepartments: ['Retail', 'Bank'] }).department).toBe('Bank');
  });
  it('query + aktif sayım default hariç', () => {
    const v = { period: 'this_week', owner: '42', from: undefined } as const;
    expect(filtersToQuery(v, config).toString()).toBe('owner=42');
    expect(countActiveFilters(v, config)).toBe(1);
    expect(countActiveFilters({ period: 'custom', from: '2026-11-01', to: '2026-11-05' }, config)).toBe(1);
  });
});
