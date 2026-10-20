import { describe, expect, it } from 'vitest';
// @ts-expect-error JavaScript CLI helper intentionally has no declaration file.
import { parseRetailReferencePlan, parseRetailReferencePool, matchRetailReferencePool, retailReferenceSalesTotals } from './retail-reference-plan-parser.mjs';

const data = () => ({
  p26: Array.from({ length: 15 }, (_, i) => ({ firm: `Firma ${i}`, model: 'A80', qty: i === 14 ? 5172 : 1, mode: 'Kiralama', prob: 60, note: i === 0 ? 'Kaynak notu' : '' })),
  p27: Array.from({ length: 17 }, (_, i) => ({ firm: `Firma ${i}`, model: 'A35', qty: i === 16 ? 6579 : 1, mode: i === 0 ? 'Banka' : 'Kiralama', prob: 30 })),
});

describe('Retail reference CRM membership parser', () => {
  const pool = () => ({ ...data(), crm: Array.from({ length: 530 }, (_, i) => ({ name: `Müşteri ${i}`, status: i === 0 ? 'Hunter' : 'Lead', kasa: i === 0 ? 'Inhouse' : 'Bilinmeyen', rawKasa: i === 0 ? 'Enpos' : '', register: null })) });
  it('preserves original portfolio status and provider group without replacing raw provider', () => {
    const parsed = parseRetailReferencePool(html(pool()));
    expect(parsed.rows).toHaveLength(530);
    expect(parsed.rows[0]).toMatchObject({ referenceName: 'Müşteri 0', retailStatus: 'Hunter', registerVendorGroup: 'Inhouse' });
    expect(parsed.rows[0].referenceSnapshot.original.rawKasa).toBe('Enpos');
  });
  it('matches exact Turkish case/whitespace names regardless of current department', () => {
    const parsed = parseRetailReferencePool(html(pool()));
    const customers = parsed.rows.map((row: { referenceName: string }, i: number) => ({ id: String(i), name: ' ' + row.referenceName.toLocaleUpperCase('tr-TR') + ' ', department: i < 50 ? 'Vertical' : 'Retail' }));
    const matched = matchRetailReferencePool(parsed.rows, customers);
    expect(matched).toHaveLength(530);
    expect(matched[0].customerId).toBe('0');
    expect(matched[0].referenceName).toBe('Müşteri 0');
  });
  it('aborts on missing or ambiguous identities instead of guessing aliases', () => {
    const parsed = parseRetailReferencePool(html(pool()));
    const customers = parsed.rows.map((row: { referenceName: string }, i: number) => ({ id: String(i), name: row.referenceName }));
    expect(() => matchRetailReferencePool(parsed.rows, customers.slice(1))).toThrow('eksik=1');
    expect(() => matchRetailReferencePool(parsed.rows, [...customers, { id: 'duplicate', name: 'Müşteri 0' }])).toThrow('belirsiz=1');
    const source = pool(); source.crm[1].name = source.crm[0].name;
    expect(() => parseRetailReferencePool(html(source))).toThrow('mükerrer');
  });
});
const html = (source = data(), months = {}) => `<script type="application/json">${JSON.stringify(source)}</script><script type="application/json" id="pipeline27-embedded-plans">${JSON.stringify(months)}</script>`;

describe('Retail reference plan JSON parser', () => {
  it('preserves 32 source rows, labels, quantities, notes and separate bank business model', () => {
    const result = parseRetailReferencePlan(html());
    expect(result.rows).toHaveLength(32);
    expect(result.rows[0]).toMatchObject({ firmName: 'Firma 0', quantity: 1, note: 'Kaynak notu', businessModel: 'rental', planYear: 2026, planMonth: 12, rentalMonthlyPrice: 15, unitPrice: null });
    expect(result.rows[15]).toMatchObject({ businessModel: 'bank', planYear: 2027, planMonth: 3, probability: 30, rentalMonthlyPrice: null });
    expect(result.rows[0].referenceSnapshot.original).toEqual(data().p26[0]);
    expect(result.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('uses embedded 2027 month overrides while retaining deterministic row keys', () => {
    const first = parseRetailReferencePlan(html());
    const changed = parseRetailReferencePlan(html(data(), { 0: 7 }));
    expect(changed.rows[15].planMonth).toBe(7);
    expect(changed.rows[15].referenceSnapshot.monthOrigin).toBe('embedded-plan');
    expect(first.rows[15].referenceKey).toBe(changed.rows[15].referenceKey);
    expect(first.sourceSha256).not.toBe(changed.sourceSha256);
  });
  it('never evaluates JavaScript embedded alongside the JSON', () => {
    const result = parseRetailReferencePlan(`<script>throw new Error('must not execute')</script>${html()}`);
    expect(result.rows).toHaveLength(32);
    expect(() => parseRetailReferencePlan('<script>const D=' + JSON.stringify(data()) + '</script>')).toThrow('JSON');
  });
  it.each([
    (source: ReturnType<typeof data>) => { source.p26.pop(); },
    (source: ReturnType<typeof data>) => { source.p26[0].qty += 1; },
    (source: ReturnType<typeof data>) => { source.p26[0].mode = 'Başka'; },
    (source: ReturnType<typeof data>) => { source.p26[0].model = "A80'); drop table x;--"; },
    (source: ReturnType<typeof data>) => { source.p26[0].prob = 101; },
  ])('rejects malformed source shape instead of silently inventing records', mutate => {
    const source = data(); mutate(source);
    expect(() => parseRetailReferencePlan(html(source))).toThrow('Retail reference');
  });
  it('rejects duplicate source JSON and invalid persisted months', () => {
    expect(() => parseRetailReferencePlan(html() + html())).toThrow();
    expect(() => parseRetailReferencePlan(html(data(), { 0: 13 }))).toThrow('Ay');
  });
  it('derives realized totals from the source JSON and rejects inconsistent firm/model revenue', () => {
    const source = { ...data(), salesF: [{ qty: 1432, usd: 404636 }], salesModels: [{ name: 'S210', qty: 678, usd: 51338 }, { name: 'A80', qty: 1432, usd: 353298 }] };
    expect(retailReferenceSalesTotals(html(source))).toEqual({ firms: 1, usd: 404636, terminals: 1432, s210: 678 });
    source.salesModels[0].usd -= 1;
    expect(() => retailReferenceSalesTotals(html(source))).toThrow('ciro');
  });
});
