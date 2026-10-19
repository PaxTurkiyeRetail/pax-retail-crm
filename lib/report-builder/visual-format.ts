/** Same zero-based extent for browser and PDF; missing/non-finite values draw no bar. */
export function dataBarExtent(values:unknown[],value:unknown):{start:number;width:number}|null {
  if(typeof value!=='number'||!Number.isFinite(value))return null;
  const numbers=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
  const min=Math.min(0,...numbers),max=Math.max(0,...numbers),span=max-min;
  if(!span)return {start:0,width:0};
  const zero=-min/span,point=Math.min(1,Math.max(0,(value-min)/span));
  return {start:Math.max(0,Math.min(zero,point)),width:Math.abs(point-zero)};
}
