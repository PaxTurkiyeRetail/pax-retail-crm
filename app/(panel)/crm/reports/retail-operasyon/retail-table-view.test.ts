import { describe, expect, it } from 'vitest';
import { retailTableView, type RetailTableColumn } from './retail-table-view';
type Row = { name: string; qty: number | null; month: number; owner: string };
const rows: Row[] = [{name:'KİĞILI',qty:200,month:12,owner:'Çağdaş'}, {name:'İPEKYOL',qty:15,month:2,owner:'Ömer'}, {name:'Bilinmeyen',qty:null,month:1,owner:''}];
const columns: RetailTableColumn<Row>[] = [{key:'name',value:r=>r.name},{key:'qty',num:true,value:r=>r.qty},{key:'month',value:r=>r.month,filterValue:r=>({1:'Ocak',2:'Şubat',12:'Aralık'})[r.month]??''},{key:'owner',value:r=>r.owner},{key:'action',value:()=> 'Forecast düzenle',searchable:false}];
describe('Retail table search, column filters and sort',()=>{
  it('searches Turkish names and accents across visible data columns but not actions',()=>{
    expect(retailTableView(rows,columns,'kigili',{},null)).toEqual([rows[0]]);
    expect(retailTableView(rows,columns,'omer',{},null)).toEqual([rows[1]]);
    expect(retailTableView(rows,columns,'Forecast düzenle',{},null)).toEqual([]);
  });
  it('combines search and multiple filters without modifying source rows',()=>{
    const before=structuredClone(rows);
    expect(retailTableView(rows,columns,'cagdas',{qty:'>=100',name:'kığılı'},null)).toEqual([rows[0]]);
    expect(retailTableView(rows,columns,'ipekyol',{qty:'>100'},null)).toEqual([]);
    expect(rows).toEqual(before);
  });
  it.each([['15',[rows[1]]],['>=15',[rows[0],rows[1]]],['<20',[rows[1]]],['10..100',[rows[1]]],['>=15,0',[rows[0],rows[1]]],['nonsense',[]]])('supports numeric filter %s with null values excluded',(filter,expected)=>{
    expect(retailTableView(rows,columns,'',{qty:filter},null)).toEqual(expected);
  });
  it('searches displayed month names but sorts months chronologically',()=>{
    expect(retailTableView(rows,columns,'subat',{},null)).toEqual([rows[1]]);
    expect(retailTableView(rows,columns,'',{month:'aralık'},null)).toEqual([rows[0]]);
    expect(retailTableView(rows,columns,'',{}, {key:'month',dir:1})).toEqual([rows[2],rows[1],rows[0]]);
  });
  it('sorts raw numbers in both directions and keeps missing values last',()=>{
    expect(retailTableView(rows,columns,'',{}, {key:'qty',dir:1})).toEqual([rows[1],rows[0],rows[2]]);
    expect(retailTableView(rows,columns,'',{}, {key:'qty',dir:-1})).toEqual(rows);
  });
});
