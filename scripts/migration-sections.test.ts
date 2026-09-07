import { describe, expect, it } from 'vitest';
// @ts-expect-error JavaScript CLI helper intentionally has no declaration file.
import { migrationSections } from './migration-sections.mjs';
describe('append-only consolidated SQL sections', () => {
  it('preserves the original baseline bytes and separates later additions', () => {
    const base = '-- original\r\nselect 1;\r\n';
    expect(migrationSections('20260818_base.sql', base + '-- CRM_APPEND_MIGRATION: 20260907_contact.sql\nselect 2;\n')).toEqual([
      { version: '20260818_base.sql', sql: base }, { version: '20260907_contact.sql', sql: 'select 2;\n' },
    ]);
  });
  it('keeps existing section content stable when another is appended', () => {
    const first = 'select 1;\n-- CRM_APPEND_MIGRATION: 20260907_a.sql\nselect 2;\n';
    expect(migrationSections('20260818_base.sql', first + '-- CRM_APPEND_MIGRATION: 20260908_b.sql\nselect 3;\n').slice(0, 2)).toEqual(migrationSections('20260818_base.sql', first));
  });
  it('rejects duplicate versions and empty sections', () => {
    expect(() => migrationSections('20260907_a.sql', 'select 1;\n-- CRM_APPEND_MIGRATION: 20260907_a.sql\nselect 2;')).toThrow('Duplicate');
    expect(() => migrationSections('20260818_base.sql', 'select 1;\n-- CRM_APPEND_MIGRATION: 20260907_a.sql\n')).toThrow('Empty');
  });
});
