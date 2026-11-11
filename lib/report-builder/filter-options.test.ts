import { describe, expect, it } from 'vitest';
import { datasetCatalog } from './datasets';

const catalog = datasetCatalog(() => true);
const portfolio = catalog.find((d) => d.key === 'customer_portfolio')!;
const dim = (key: string) => portfolio.dimensions.find((d) => d.key === key)!;

describe('rapor tasarımcısı filtre seçenekleri', () => {
  it('satıcı/sorumlu alanları hesap yöneticisi listesine bağlı', () => {
    expect(dim('customer_owner').optionSource).toBe('owners');
    for (const ds of catalog) for (const d of ds.dimensions.filter((x) => x.key === 'owner')) expect(d.optionSource, `${ds.key}.owner`).toBe('owners');
  });

  it('sabit değerli alanlar açılır liste seçenekleri taşır', () => {
    expect(dim('has_quote').options).toEqual(['Teklif var', 'Teklif yok']);
    expect(dim('poc_status').options).toEqual(['Konsinye', 'Pilot / POC', 'Uçtan Uca Test', 'POC sonrası', 'POC yok']);
    expect(dim('sale_kind').options).toContain('Kiralama');
    expect(dim('department').options).toEqual(['Retail', 'Vertical', 'Bank']);
  });
});

