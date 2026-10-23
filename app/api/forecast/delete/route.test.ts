import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({access:vi.fn(),query:vi.fn()}));
vi.mock('@/lib/authz',()=>({requireAnyPermissionOrThrow:mocks.access,userHasPermission:(user:{permissions:string[]},permission:string)=>user.permissions.includes(permission)}));
vi.mock('@/lib/db',()=>({db:{query:mocks.query}}));
vi.mock('@/lib/forecast',()=>({isMissingForecastRelation:()=>false}));
import { POST } from './route';
const actor={id:'11111111-1111-4111-8111-111111111111',email:'actor@example.test',full_name:'Actor',permissions:['forecast.write.own']};
const record={id:'22222222-2222-4222-8222-222222222222',owner_user_id:actor.id};
const request=(patch:Record<string,unknown>={})=>new Request('http://localhost/api/forecast/delete',{method:'POST',body:JSON.stringify({id:record.id,...patch})});
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue(actor);mocks.query.mockResolvedValue({rows:[record]});});
describe('Forecast soft deletion',()=>{
  it('archives only the expected version and rechecks current ownership in the update',async()=>{
    const stamp='2026-10-23 12:15:13.123456+03';
    const response=await POST(request({expected_updated_at:stamp}));
    expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});
    expect(mocks.access).toHaveBeenCalledWith(['forecast.write.own','forecast.write.any']);
    const [sql,params]=mocks.query.mock.calls[1];
    expect(sql).toContain('is_active = false');expect(sql).toContain('and is_active=true');
    expect(sql).toContain('updated_at=$4::timestamptz');expect(sql).toContain('customer.owner_user_id=$6::uuid');
    expect(params).toEqual([record.id,actor.email,actor.full_name,stamp,false,actor.id]);
  });
  it('keeps legacy callers without version timestamps supported',async()=>{
    expect((await POST(request())).status).toBe(200);expect(mocks.query.mock.calls[1][1][3]).toBeNull();
  });
  it.each(['bad','',42,null])('rejects invalid version %j without a database call',async stamp=>{
    expect((await POST(request({expected_updated_at:stamp}))).status).toBe(400);expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects another owner before updating',async()=>{
    mocks.query.mockResolvedValueOnce({rows:[{...record,owner_user_id:'other'}]});
    expect((await POST(request())).status).toBe(403);expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('lets any-scope users archive another owner with an atomic scope guard',async()=>{
    mocks.access.mockResolvedValueOnce({...actor,permissions:['forecast.write.any']});
    mocks.query.mockResolvedValueOnce({rows:[{...record,owner_user_id:'other'}]});
    expect((await POST(request())).status).toBe(200);expect(mocks.query.mock.calls[1][1].slice(4)).toEqual([true,actor.id]);
  });
  it('returns conflict when a concurrent edit, deletion or owner change prevents the update',async()=>{
    mocks.query.mockResolvedValueOnce({rows:[record]}).mockResolvedValueOnce({rows:[]});
    expect((await POST(request())).status).toBe(409);
  });
  it('does not update a record that is missing or already archived',async()=>{
    mocks.query.mockResolvedValueOnce({rows:[]});expect((await POST(request())).status).toBe(404);expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('does not touch the database when permission is denied',async()=>{
    mocks.access.mockRejectedValueOnce(Object.assign(new Error('FORBIDDEN'),{status:403}));
    expect((await POST(request())).status).toBe(403);expect(mocks.query).not.toHaveBeenCalled();
  });
});
