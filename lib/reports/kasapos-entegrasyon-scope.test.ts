import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {query}=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{query}}));
vi.mock('@/lib/audit',()=>({tryRecordAuditEvent:vi.fn()}));
import{buildKasaposEntegrasyonRaporu}from'./kasapos-entegrasyon';
beforeEach(()=>{query.mockReset().mockResolvedValue({rows:[]});});
describe('KasaPOS shared department scope',()=>{
  it.each(['Retail','Bank',undefined] as const)('uses the same bound scope for invoice and customer aggregates: %s',async department=>{
    await buildKasaposEntegrasyonRaporu({year:2026,department});
    expect(query).toHaveBeenCalledTimes(2);
    for(const [sql,params]of query.mock.calls){expect(params[2]).toBe(department??null);expect(sql).toContain('$3::text is null');}
    expect(query.mock.calls[0][0]).toContain('scope_customer.id=s.customer_id');
    expect(query.mock.calls[0][0]).toContain('scope_customer.is_kolu=$3::text');
    expect(query.mock.calls[1][0]).toContain('m.is_kolu=$3::text');
  });
});
