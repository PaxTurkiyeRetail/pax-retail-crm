import {describe,it,expect} from 'vitest';
import {dataBarExtent} from './visual-format';
describe('web/PDF shared data bars',()=>{
  it('uses zero baseline for positive and negative domains',()=>{expect(dataBarExtent([10,20],10)).toEqual({start:0,width:.5});expect(dataBarExtent([-20,-10],-10)).toEqual({start:.5,width:.5});});
  it('keeps mixed values on opposite sides of zero',()=>{expect(dataBarExtent([-10,10],-10)).toEqual({start:0,width:.5});expect(dataBarExtent([-10,10],10)).toEqual({start:.5,width:.5});});
  it('does not turn missing values into zero and handles zero domains',()=>{expect(dataBarExtent([null,0],null)).toBeNull();expect(dataBarExtent([0,0],0)).toEqual({start:0,width:0});expect(dataBarExtent([1],NaN)).toBeNull();});
});
