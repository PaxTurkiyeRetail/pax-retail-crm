import { describe, expect, it } from 'vitest';
import { normalizePageSize } from './ui-pagination';

describe('parametric UI pagination', () => {
  it('accepts only the supported page-size contract', () => {
    expect(normalizePageSize('25')).toBe(25);
    expect(normalizePageSize(100)).toBe(100);
    expect(normalizePageSize('999')).toBe(25);
  });

  it('uses the caller safe default for invalid values', () => {
    expect(normalizePageSize(undefined, 20)).toBe(20);
  });
});
