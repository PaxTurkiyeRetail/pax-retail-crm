import type {ForecastQuickAddOptions} from '@/components/forecast/ForecastQuickAdd';
import type {RetailBusinessModel} from '@/lib/reports/retail-projection';
export const isBankChannel=(value:{value:string;label:string})=>/bank/i.test(`${value.value} ${value.label}`);
export function forecastChannel(options:ForecastQuickAddOptions|null,business:RetailBusinessModel,preferred=''){
  const channels=options?.salesChannels??[];
  if(business==='bank')return channels.find(isBankChannel)?.value??null;
  const eligible=channels.filter(c=>!isBankChannel(c));
  return eligible.find(c=>c.value===preferred)?.value??eligible[0]?.value??null;
}
export function canonicalForecastItem(input:{productId:string;quantity:number;year:number;month:number;channel:string;business:RetailBusinessModel;probability:number;note:string;unitPrice:number|null;rentalMonthlyPrice:number|null;includeInRetailPlan?:boolean}){
  return {product_id:input.productId,quantity:input.quantity,forecast_year:input.year,forecast_month:input.month,sales_channel:input.channel,probability:input.probability,note:input.note,sale_type:input.business==='rental'?'rental':'sale',unit_price:input.unitPrice,rental_monthly_price:input.business==='rental'?input.rentalMonthlyPrice:null,include_in_retail_plan:input.includeInRetailPlan??true};
}
