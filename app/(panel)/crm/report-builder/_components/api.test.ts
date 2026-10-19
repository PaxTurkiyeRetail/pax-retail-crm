import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { friendlyError } from './friendly';

afterEach(() => vi.unstubAllGlobals());

describe('report API validation feedback', () => {
  it('renders structured validation details as readable text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: {
      message: 'Geçersiz seçim', details: [{ path: 'page', message: 'Pano seçin' }, 'Dönemi kontrol edin', { unexpected: true }, null],
    } }, { status: 400 })));
    const error = await api.createPage({ templateKey: 'retail_operasyon' }).catch((failure: unknown) => failure);
    expect(friendlyError(error)).toBe('Seçimlerde bir sorun var: Pano seçin; Dönemi kontrol edin');
    expect(friendlyError(error)).not.toContain('[object Object]');
  });
});
