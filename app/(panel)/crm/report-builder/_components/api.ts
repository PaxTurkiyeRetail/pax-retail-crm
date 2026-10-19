'use client';
// İstemci API yardımcıları — /api/report-builder/*.
import type { DatasetCatalogEntry } from '@/lib/report-builder/datasets';
import type { PageDefinition } from '@/lib/report-builder/page-types';
import type { WidgetData } from '@/lib/report-builder/pdf';
import type { ReportResult } from '@/lib/report-builder/result';
import type { ReportDefinitionInput } from '@/lib/report-builder/types';

export class ApiFailure extends Error {
  constructor(message: string, public status: number, public details?: string[]) { super(message); }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.error ?? body;
    const details = Array.isArray(err?.details) ? err.details.flatMap((detail: unknown) => {
      if (typeof detail === 'string') return [detail];
      if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') return [detail.message];
      return [];
    }) : undefined;
    throw new ApiFailure(err?.message ?? `İstek başarısız (${res.status})`, res.status, details);
  }
  return res.json() as Promise<T>;
}

export const api = {
  datasets: () => call<{ datasets: DatasetCatalogEntry[]; scope: 'all' | 'own' | null }>('/api/report-builder/datasets'),
  query: (definition: ReportDefinitionInput) => call<ReportResult & { scope: string }>('/api/report-builder/query', { method: 'POST', body: JSON.stringify({ definition }) }),
  definitions: () => call<{ definitions: SavedDefinitionLite[]; userId: string }>('/api/report-builder/definitions'),
  createDefinition: (body: object) => call<{ id: string }>('/api/report-builder/definitions', { method: 'POST', body: JSON.stringify(body) }),
  updateDefinition: (id: string, body: object) => call<{ ok: true }>(`/api/report-builder/definitions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  pages: () => call<{ pages: SavedPageLite[]; templates: { key: string; label: string }[]; canDesign: boolean; canManageLetterheads: boolean }>('/api/report-builder/pages'),
  page: (id: string) => call<{ page: SavedPageLite & { page: PageDefinition } }>(`/api/report-builder/pages/${id}`),
  createPage: (body: object) => call<{ id: string }>('/api/report-builder/pages', { method: 'POST', body: JSON.stringify(body) }),
  updatePage: (id: string, body: object) => call<{ ok: true; version: number }>(`/api/report-builder/pages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  archivePage: (id: string) => call<{ ok: true }>(`/api/report-builder/pages/${id}`, { method: 'DELETE' }),
  versions: (id: string) => call<{ versions: { version: number; title: string; created_at: string; created_by: string | null }[] }>(`/api/report-builder/pages/${id}/versions`),
  restore: (id: string, version: number) => call<{ ok: true; version: number }>(`/api/report-builder/pages/${id}/versions`, { method: 'POST', body: JSON.stringify({ version }) }),
  runPage: (body: { pageId?: string; page?: PageDefinition; values?: Record<string, unknown>; widgetIds?: string[] }) =>
    call<{ data: Record<string, WidgetData> }>('/api/report-builder/pages/run', { method: 'POST', body: JSON.stringify(body) }),
  letterheads: () => call<{ letterheads: LetterheadLite[]; canManage: boolean }>('/api/report-builder/letterheads'),
  uploadLetterhead: (form: FormData) => call<{ id: string }>('/api/report-builder/letterheads', { method: 'POST', body: form }),
  updateLetterhead: (id: string, settings: object) => call<{ ok: true }>(`/api/report-builder/letterheads/${id}`, { method: 'PUT', body: JSON.stringify(settings) }),
  deactivateLetterhead: (id: string) => call<{ ok: true }>(`/api/report-builder/letterheads/${id}`, { method: 'DELETE' }),
};

/** PDF: Blob döner (indirme veya iframe önizleme). */
export async function fetchPdf(body: object): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch('/api/report-builder/pdf', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new ApiFailure(b?.error?.message ?? b?.message ?? 'PDF üretilemedi', res.status);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename="([^"]+)"/.exec(cd);
  return { blob: await res.blob(), fileName: m?.[1] ?? 'rapor.pdf' };
}

export async function downloadCsv(definition: ReportDefinitionInput) {
  const res = await fetch('/api/report-builder/query?format=csv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ definition }) });
  if (!res.ok) throw new ApiFailure('CSV indirilemedi', res.status);
  const m = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '');
  saveBlob(await res.blob(), m?.[1] ?? 'rapor.csv');
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type SavedDefinitionLite = { id: string; title: string; description: string; owner_user_id?: string; owner_name: string | null; visibility: string; is_favorite?: boolean; definition: ReportDefinitionInput; updated_at: string; version: number };
export type SavedPageLite = { show_in_menu?: boolean; id: string; title: string; owner_name: string | null; visibility: 'private' | 'roles' | 'everyone'; shared_roles: string[]; is_template: boolean; template_key?: string | null; version: number; letterhead_id: string | null; updated_at: string; can_edit: boolean };
export type LetterheadLite = { isBuiltin?: boolean; id: string; name: string; mimeType: string; byteSize: number; orientation: 'portrait' | 'landscape'; margins: { top: number; right: number; bottom: number; left: number }; safeArea: { top: number; bottom: number }; showTitle: boolean; showDate: boolean; showPageNumbers: boolean; footerText: string; isDefault: boolean };
