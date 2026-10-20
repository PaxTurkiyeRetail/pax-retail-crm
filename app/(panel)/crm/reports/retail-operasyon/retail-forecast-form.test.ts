import {describe,expect,it} from 'vitest';
import {canonicalForecastItem,forecastChannel} from './retail-forecast-form';
import type {ForecastQuickAddOptions} from '@/components/forecast/ForecastQuickAdd';
const options:ForecastQuickAddOptions={products:[],months:[],years:[],probabilities:[],salesChannels:[{label:'Doğrudan',value:'direct'},{label:'Banka',value:'bank_partner'}]};
const base={productId:'native-product-id',quantity:7,year:2027,month:4,channel:'direct',business:'sale' as const,probability:60,note:'Canlı kayıt',unitPrice:150,rentalMonthlyPrice:20};
describe('canonical Retail Forecast forms',()=>{
  it('encodes bank as canonical sale_type + configured bank channel, not an invented third sale type',()=>{
    const channel=forecastChannel(options,'bank')!;const item=canonicalForecastItem({...base,business:'bank',channel});
    expect(item).toMatchObject({sale_type:'sale',sales_channel:'bank_partner',product_id:'native-product-id',forecast_year:2027,forecast_month:4,quantity:7,probability:60,unit_price:150,rental_monthly_price:null});
    expect(item).not.toHaveProperty('businessModel');
  });
  it('preserves native rental pricing, include flag, note and month',()=>{
    expect(canonicalForecastItem({...base,business:'rental',includeInRetailPlan:false})).toMatchObject({sale_type:'rental',rental_monthly_price:20,include_in_retail_plan:false,note:'Canlı kayıt',forecast_month:4});
  });
  it('never silently maps missing bank configuration into a regular sale channel',()=>{
    expect(forecastChannel({...options,salesChannels:[options.salesChannels[0]]},'bank')).toBeNull();
    expect(forecastChannel(options,'sale','bank_partner')).toBe('direct');
  });
});
