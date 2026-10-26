import { describe, expect, it } from 'vitest';
import { mapKunyeDbToUi, mapKunyeUiToDb, normalizeKunyePayload, parseMevcutPosSayisi } from './kunye';

describe('Mevcut Pos Sayısı', () => {
  it.each([null, undefined, '', '   '])('keeps unknown counts empty: %s', (value) => {
    expect(parseMevcutPosSayisi(value)).toBeNull();
  });

  it.each(['0', '150', '2147483647'])('preserves exact count through save and reload: %s', (value) => {
    const payload = normalizeKunyePayload({ mevcut_pos_sayisi: value, toplam_pos_adedi: '999' });
    const record = mapKunyeUiToDb(payload);
    expect(record.mevcut_pos_sayisi).toBe(Number(value));
    expect(record.toplam_pos_adedi).toBe(999);
    expect(mapKunyeDbToUi(record)?.mevcut_pos_sayisi).toBe(value);
  });

  it.each(['-1', '1.5', '1e3', 'abc', '2147483648', true, [], {}])('rejects invalid count: %s', (value) => {
    expect(() => normalizeKunyePayload({ mevcut_pos_sayisi: value })).toThrow();
  });
});
