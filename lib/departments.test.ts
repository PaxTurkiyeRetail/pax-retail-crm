import { describe, expect, it } from 'vitest';
import { normalizeDepartments, resolveDepartmentFilter } from './departments';

describe('departments', () => {
  it('normalizeDepartments geçersizleri atar, sırayı sabitler', () => {
    expect(normalizeDepartments(['vertical', 'X', 'Retail', 'Retail'])).toEqual(['Retail', 'Vertical']);
    expect(normalizeDepartments(null)).toEqual([]);
  });

  it('kısıtsız kullanıcı: istenen veya hepsi', () => {
    expect(resolveDepartmentFilter('', null)).toBeNull();
    expect(resolveDepartmentFilter('bank', null)).toEqual(['Bank']);
    expect(resolveDepartmentFilter('Foo', null)).toBeNull();
  });

  it('kısıtlı kullanıcı: izin dışı istek izinliye daralır', () => {
    expect(resolveDepartmentFilter('', ['Retail'])).toEqual(['Retail']);
    expect(resolveDepartmentFilter('Vertical', ['Retail'])).toEqual(['Retail']);
    expect(resolveDepartmentFilter('', ['Retail', 'Bank'])).toEqual(['Retail', 'Bank']);
    expect(resolveDepartmentFilter('Bank', ['Retail', 'Bank'])).toEqual(['Bank']);
  });
});
