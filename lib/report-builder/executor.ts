import 'server-only';
import { db } from '@/lib/db';
import { compileReport, type CompiledQuery } from '@/lib/report-builder/compiler';
import { getDataset } from '@/lib/report-builder/datasets';
import { istanbulToday } from '@/lib/report-builder/dates';
import { mergeCompare, normalizeRows, type ReportResult } from '@/lib/report-builder/result';
import type { CalcExpr, ReportDefinition, RowScope } from '@/lib/report-builder/types';

export const QUERY_TIMEOUT_MS = 15_000;

async function runReadOnly(compiled: CompiledQuery) {
  const client = await db.connect();
  try {
    await client.query('begin transaction read only');
    // Sabit değer (kullanıcı girdisi değil). set local → yalnız bu transaction.
    await client.query(`set local statement_timeout = ${QUERY_TIMEOUT_MS}`);
    const result = await client.query(compiled.sql, compiled.params);
    await client.query('commit');
    return result.rows as Record<string, unknown>[];
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    if ((error as { code?: string })?.code === '57014') {
      throw Object.assign(new Error('Sorgu zaman aşımına uğradı; aralığı daraltın veya kırılım azaltın.'), { status: 408 });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function executeReport(def: ReportDefinition, scope: RowScope): Promise<ReportResult> {
  const started = Date.now();
  const today = istanbulToday();
  const current = compileReport(def, { scope, today });
  const currentRaw = await runReadOnly(current);
  const truncated = currentRaw.length > current.limit;
  let columns = current.columns;
  let rows = normalizeRows(columns, currentRaw.slice(0, current.limit));
  let compareRange: ReportResult['compareRange'] = null;

  if (def.compare !== 'none' && def.dateRange) {
    const previous = compileReport(def, { scope, today, period: 'compare' });
    const prevRows = normalizeRows(previous.columns, (await runReadOnly(previous)).slice(0, previous.limit));
    ({ columns, rows } = mergeCompare(columns, rows, prevRows));
    compareRange = previous.range;
  }

  const source=getDataset(def.dataset)!;
  const explain=(e:CalcExpr):string=>'measure' in e?(source.measures[e.measure]?.label??e.measure):'const' in e?String(e.const):e.op==='pct'?`Yüzde(${explain(e.left)} / ${explain(e.right)})`:`(${explain(e.left)} ${{add:'+',sub:'−',mul:'×',div:'÷'}[e.op]} ${explain(e.right)})`;
  const warnings:string[]=[];
  if(truncated)warnings.push('Satır sınırına ulaşıldı; gösterilen kayıtlar sonucun tamamını içermeyebilir.');
  const missing=columns.filter(c=>c.role!=='dimension'&&rows.some(r=>r[c.key]===null)).map(c=>c.label);
  if(missing.length)warnings.push(`Değeri bulunmayan hesaplar: ${missing.join(', ')}. Boş değerler sıfır değildir.`);
  if(def.dataset==='performance_comparison')warnings.push('Hedefler Account ve tam ay düzeyindedir; çeyrek/yıl hedefleri aylara eşit paylaştırılır. Müşteri/model hedefi veya USD Forecast tahmini üretilmez.');
  if(def.dataset==='kasapos_snapshot')warnings.push('Kasa stoku güncel durumdur; geçmiş stok değildir. Fırsat geliri yalnız fiyatı bilinen kayıtlarla hesaplanır.');
  return { columns, rows, truncated, range: current.range, compareRange, durationMs: Date.now() - started,
    provenance:{queriedAt:new Date().toISOString(),source:def.dataset,sourceLabel:source.label,scope:scope.kind,description:source.description,
      measures:[...def.measures.map(key=>({label:source.measures[key].label,description:source.measures[key].description??source.measures[key].label})),...def.calculated.map(c=>({label:c.label,description:c.formula??(c.expr?explain(c.expr):'Hesaplanmış ölçü')}))],warnings} };

}
