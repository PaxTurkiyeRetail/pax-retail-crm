import { describe, expect, it } from 'vitest';
import { contractEndDate, parseContractFields } from './contract';

describe('parseContractFields', () => {
  it('keeps current values when fields are not sent', () => {
    const r = parseContractFields({}, { billing_start_date: '2026-01-01', contract_no: 'A1', contract_months: 12 });
    expect(r).toEqual({ value: { billing_start_date: '2026-01-01', contract_no: 'A1', contract_months: 12, contract_ended_on: null } });
  });
  it('sets and clears contract end, rejects end before billing start', () => {
    expect(parseContractFields({ contract_ended_on: '2027-05-31' }, { billing_start_date: '2027-03-01' }))
      .toMatchObject({ value: { contract_ended_on: '2027-05-31' } });
    expect(parseContractFields({ contract_ended_on: '' }, { contract_ended_on: '2027-05-31' }))
      .toMatchObject({ value: { contract_ended_on: null } });
    expect('error' in parseContractFields({ contract_ended_on: '2027-01-01' }, { billing_start_date: '2027-03-01' })).toBe(true);
  });
  it('clears with empty values', () => {
    const r = parseContractFields({ billing_start_date: '', contract_no: ' ', contract_months: '' }, { contract_months: 6 });
    expect(r).toEqual({ value: { billing_start_date: null, contract_no: null, contract_months: null, contract_ended_on: null } });
  });
  it('rejects bad input', () => {
    expect('error' in parseContractFields({ billing_start_date: '01.02.2026' })).toBe(true);
    expect('error' in parseContractFields({ contract_months: 0 })).toBe(true);
    expect('error' in parseContractFields({ contract_months: 2.5 })).toBe(true);
  });
});

describe('contractEndDate', () => {
  it('adds months minus one day', () => {
    expect(contractEndDate('2026-01-01', 12)).toBe('2026-12-31');
    expect(contractEndDate('2026-03-15', 1)).toBe('2026-04-14');
  });
  it('clamps month end like postgres', () => {
    expect(contractEndDate('2026-01-31', 1)).toBe('2026-02-27');
  });
  it('returns null without months', () => {
    expect(contractEndDate('2026-01-01', null)).toBeNull();
  });
});
