'use client';
import { useEffect, useRef, useState } from 'react';
import type { ColumnMeta, ReportDefinition } from '@/lib/report-builder/types';
import { formatCell, type ReportResult } from '@/lib/report-builder/result';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function DrilldownPanel({ definition, row, onClose }: { definition: ReportDefinition; row: Record<string, unknown>; columns?: ColumnMeta[]; onClose: () => void }) {
  const [result, setResult] = useState<ReportResult>();
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0);
      const first = targets[0]; const last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setResult(undefined); setError('');
    fetch('/api/report-builder/drilldown', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ definition, row }), signal: abort.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'Kayıtlar yüklenemedi'); return data; })
      .then(setResult).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [definition, row]);
  return <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Katkıda bulunan kayıtlar" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <div className="max-h-[85vh] w-full max-w-6xl overflow-auto rounded-xl border bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Katkıda bulunan kayıtlar</h2><button type="button" className="pax-btn" onClick={onClose}>Kapat</button></div>
      <p className="mb-3 text-xs text-[var(--muted)]">Seçilen grubun filtreleri ve erişim kapsamınız uygulanır. En fazla 500 satır gösterilir.</p>
      {definition.dataset === 'performance_comparison' && <p className="mb-3 text-sm">Hedef verileri aylık Account düzeyindedir; tekil işlem kaydı içermez.</p>}
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p role="status">Yükleniyor…</p>}
      {result && <><table className="pax-table w-full"><thead><tr>{result.columns.map(c => <th key={c.key}>{c.label}</th>)}<th>Kayıt</th></tr></thead><tbody>{result.rows.map((r, i) => <tr key={i}>{result.columns.map(c => <td key={c.key}>{formatCell(c, r[c.key])}</td>)}<td>{result.columns.filter(c => ['customer_id', 'quote_id'].includes(c.sourceField ?? '')).map(c => {
        const id = String(r[c.key] ?? '');
        return uuid.test(id) ? <a className="mr-2 underline" key={c.key} href={c.sourceField === 'customer_id' ? `/crm/${id}` : `/crm/quotes/${id}`}>{c.sourceField === 'customer_id' ? 'Müşteri' : 'Teklif'}</a> : null;
      })}</td></tr>)}</tbody></table>{!result.rows.length && <p>Kayıt yok</p>}{result.truncated && <p className="mt-2 text-sm">Sonuç kesildi; filtreleri daraltın.</p>}</>}
    </div>
  </div>;
}


