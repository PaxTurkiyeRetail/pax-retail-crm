export type CalculationPreset = 'average' | 'difference' | 'percentage';
export type CalculationMeasure = { key: string; label: string };
export function calculationPreset(preset: CalculationPreset, a: CalculationMeasure, b: CalculationMeasure, usedKeys: readonly string[] = []) {
  if (![a.key, b.key].every(key => /^[a-z][a-z0-9_]{0,63}$/.test(key))) throw new Error('Geçersiz gösterge anahtarı');
  const stem = `${preset}_${a.key}_${b.key}`.slice(0, 56);
  let key = stem; let suffix = 2;
  while (usedKeys.includes(key)) key = `${stem}_${suffix++}`;
  const formula = preset === 'difference' ? `[${a.key}] - [${b.key}]` : `${preset === 'percentage' ? 'PCT' : 'DIV'}([${a.key}], [${b.key}])`;
  const label = preset === 'difference' ? `${a.label} − ${b.label}` : preset === 'percentage' ? `${a.label} / ${b.label} (%)` : `${a.label} / ${b.label} ortalaması`;
  return { key, label: label.slice(0, 80), formula, format: preset === 'percentage' ? 'percent' as const : 'number' as const };
}
