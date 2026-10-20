import{beforeEach,describe,expect,it,vi}from'vitest';
const{access}=vi.hoisted(()=>({access:vi.fn()}));
vi.mock('@/lib/authz',()=>({requireReportsAccessOrThrow:access}));
import{POST}from'./route';import{PATCH}from'./[id]/route';
beforeEach(()=>{access.mockReset().mockResolvedValue({id:'reader'});});
describe('retired snapshot mutation routes',()=>{
 it.each([POST,PATCH])('rejects obsolete writes instead of creating invisible plan records',async handler=>{const r=await handler();expect(r.status).toBe(410);expect((await r.json()).message).toContain('ana Forecast');});
 it.each([POST,PATCH])('keeps report authorization enforced',async handler=>{access.mockRejectedValue(Object.assign(new Error('FORBIDDEN'),{status:403}));expect((await handler()).status).toBe(403);});
});
