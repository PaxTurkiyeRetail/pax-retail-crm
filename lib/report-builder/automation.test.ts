import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({query:vi.fn(),poolQuery:vi.fn(),release:vi.fn(),page:vi.fn(),run:vi.fn(),mail:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{connect:async()=>({query:mocks.query,release:mocks.release}),query:mocks.poolQuery}}));
vi.mock('@/lib/report-builder/pages-repo',()=>({getPage:mocks.page,loadLetterheadAsset:vi.fn()}));
vi.mock('@/lib/report-builder/page-runner',()=>({runPage:mocks.run}));
vi.mock('@/lib/report-builder/pdf',()=>({loadPdfFonts:vi.fn(),renderPagePdf:vi.fn()}));
vi.mock('@/lib/mail',()=>({sendMail:mocks.mail,isMailConfigured:()=>true}));
vi.mock('@/lib/authz',()=>({resolveRolePermissionsFromDb:async()=>['report.read.own']}));
import { executeAutomation } from './automation';
import { backgroundRoles } from './automation-types';
import type { ReportUser } from './access';
const user:ReportUser={id:'owner',email:'owner@example.com',full_name:'Owner',permissions:['report.read.own']};
const automation={id:'a',page_id:'p',owner_user_id:'owner',name:'Test',kind:'delivery',interval_hours:24,next_run_at:'2020-01-01T00:00:00Z',format:'csv',is_active:true,config:{permissionCeiling:['report.read.own']},last_condition:false};
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes('try_advisory')?[{locked:true}]:sql.startsWith('select *')?[automation]:sql.startsWith('insert into')?[{id:'run'}]:[]}));
  mocks.poolQuery.mockResolvedValue({rows:[{...user,role:'account_manager',permissions:user.permissions}]});
  mocks.page.mockResolvedValue({owner_user_id:'owner',page:{widgets:[],pdf:{}}});mocks.run.mockResolvedValue({});
});
describe('report automation execution boundary',()=>{
  it('requires an active AD session and never falls back to a privileged legacy role',()=>{
    expect(()=>backgroundRoles('super_admin',true,null)).toThrow('yeniden giriş');
    expect(backgroundRoles('super_admin',true,['sales'])).toEqual(['sales']);
    expect(backgroundRoles('sales',false,null)).toEqual(['sales']);
  });
  it('manual preview renders without sending mail or advancing scheduled cursor',async()=>{
    expect((await executeAutomation('a',{previewUser:user})).status).toBe('preview');
    expect(mocks.mail).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.some(([sql])=>sql.includes('next_run_at=now()'))).toBe(false);
  });
  it('rejects a different owner before any render or mail',async()=>{
    await expect(executeAutomation('a',{previewUser:{...user,id:'other'}})).rejects.toThrow();
    expect(mocks.run).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();
  });
  it('does not render a period already claimed by another run',async()=>{
    mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes('try_advisory')?[{locked:true}]:sql.startsWith('select *')?[automation]:[]}));
    expect((await executeAutomation('a')).status).toBe('already_claimed');
    expect(mocks.run).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();
  });
  it('does not send partial results or denied widgets',async()=>{
    mocks.run.mockResolvedValue({w:{error:'forbidden'}});
    await expect(executeAutomation('a')).rejects.toThrow('Veri eksik');
    expect(mocks.mail).not.toHaveBeenCalled();
  });
  it('does not send when a saved data widget has no result',async()=>{
    mocks.page.mockResolvedValue({owner_user_id:'owner',page:{widgets:[{id:'missing',type:'kpi',query:{}}],pdf:{}}});
    await expect(executeAutomation('a')).rejects.toThrow('Veri eksik');
    expect(mocks.mail).not.toHaveBeenCalled();
  });
  it('rearms after false and preserves the old condition when mail fails',async()=>{
    const alert={...automation,kind:'alert',last_condition:false,config:{...automation.config,alert:{widgetId:'w',column:'revenue',op:'gt',threshold:100}}};
    mocks.query.mockImplementation(async(sql:string,params:unknown[])=>{
      if(sql.includes('set last_condition='))alert.last_condition=params[1] as boolean;
      return {rows:sql.includes('try_advisory')?[{locked:true}]:sql.startsWith('select *')?[alert]:sql.startsWith('insert into')?[{id:'run'}]:[]};
    });
    mocks.mail.mockResolvedValue({status:'sent',detail:'sent'});
    for(const value of [0,200,200,0,200]) {
      mocks.run.mockResolvedValue({w:{result:{columns:[{key:'revenue',label:'Revenue',role:'measure',type:'number'}],rows:[{revenue:value}],truncated:false}}});
      await executeAutomation('a');
    }
    expect(mocks.mail).toHaveBeenCalledTimes(2);
    alert.last_condition=false;
    mocks.mail.mockResolvedValue({status:'failed',detail:'provider error'});
    expect((await executeAutomation('a')).status).toBe('failed');
    expect(alert.last_condition).toBe(false);
  });
  it('does not repeat an alert while its condition remains true',async()=>{
    const alert={...automation,kind:'alert',last_condition:true,config:{...automation.config,alert:{widgetId:'w',column:'revenue',op:'gt',threshold:100}}};
    mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes('try_advisory')?[{locked:true}]:sql.startsWith('select *')?[alert]:sql.startsWith('insert into')?[{id:'run'}]:[]}));
    mocks.run.mockResolvedValue({w:{result:{columns:[{key:'revenue',label:'Revenue',role:'measure',type:'number'}],rows:[{revenue:200}],truncated:false}}});
    expect((await executeAutomation('a')).status).toBe('quiet');
    expect(mocks.mail).not.toHaveBeenCalled();
  });
});
