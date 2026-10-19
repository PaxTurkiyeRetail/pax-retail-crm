'use client';
import type { ReportResult } from '@/lib/report-builder/result';
export default function ReportDataInfo({result}:{result?:ReportResult}) {
  const info=result?.provenance;
  if(!result)return null;
  return <details className="mt-3 rounded-lg border p-3 text-xs text-[var(--muted)]"><summary className="cursor-pointer font-semibold">Veri kaynağı ve hesaplar{result.truncated?' · Sonuç kesildi':''}</summary><div className="mt-3 space-y-2">
    {info&&<><p><strong>Kaynak:</strong> {info.sourceLabel}</p><p>{info.description}</p><p><strong>Son sorgulama:</strong> {new Date(info.queriedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}</p><p><strong>Erişim kapsamı:</strong> {info.scope==='all'?'Yetkili olduğunuz tüm kayıtlar':'Size ait kayıtlar'}</p><ul>{info.measures.map((m,i)=><li key={i}><strong>{m.label}:</strong> {m.description}</li>)}</ul>{info.warnings.map(w=><p key={w} role="note">{w}</p>)}</>}
    <p><strong>Dönem:</strong> {result.range?`${result.range.from} – ${result.range.to}`:'Tarih sınırı yok / anlık kaynak'}</p><p>{result.rows.length} satır · {result.durationMs} ms{result.truncated?' · Satır sınırı nedeniyle sonuç tamamlanmamış olabilir.':''}</p><p>Sorgulama zamanı, kaynak kayıtların son değiştirilme zamanı değildir.</p>
  </div></details>;
}
