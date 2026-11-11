import { describe, expect, it } from 'vitest';
import { OWNER_GROUP_LABEL, buildOwnerOptions, ownerNameKey, ownerValueFromName, resolveOwner } from './owner-filter';
import { PSEUDO_OWNERS } from './live-board-shared';

describe('owner-filter', () => {
  it('ownerNameKey üretir regex uyumlu anahtar', () => {
    const key = ownerNameKey('Havuz Account');
    expect(key).toBe('n-havuz-account');
    expect(key).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it('kişiler önce, havuz/gruplar sonra grup etiketiyle', () => {
    const opts = buildOwnerOptions([{ id: 'u1', name: 'Zeynep Test' }]);
    const firstGroup = opts.findIndex((o) => o.group === OWNER_GROUP_LABEL);
    expect(firstGroup).toBeGreaterThan(0);
    expect(opts.slice(firstGroup).every((o) => o.group === OWNER_GROUP_LABEL)).toBe(true);
    expect(opts.slice(firstGroup).map((o) => o.label)).toEqual([...PSEUDO_OWNERS]);
    expect(opts.some((o) => o.value === 'u1')).toBe(true);
  });

  it('includePseudo=false havuzları çıkarır, pseudo kullanıcıyı kişi saymaz', () => {
    const opts = buildOwnerOptions([{ id: 'p1', name: PSEUDO_OWNERS[0] }], { includePseudo: false });
    expect(opts.some((o) => o.group)).toBe(false);
    expect(opts.some((o) => o.value === 'p1')).toBe(false);
  });

  it('resolveOwner id ve ad-anahtarını ayırır', () => {
    const opts = buildOwnerOptions([{ id: 'u1', name: 'Zeynep Test' }]);
    expect(resolveOwner('u1', opts)).toEqual({ value: 'u1', id: 'u1', name: 'Zeynep Test' });
    const pseudo = resolveOwner(ownerNameKey(PSEUDO_OWNERS[0]), opts);
    expect(pseudo?.id).toBeNull();
    expect(resolveOwner('yok', opts)).toBeNull();
    expect(ownerValueFromName('zeynep test', opts)).toBe('u1');
  });
});
