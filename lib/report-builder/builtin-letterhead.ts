import fs from 'node:fs/promises';
import path from 'node:path';
import { letterheadSettingsSchema } from './page-types';

export const PAX_LETTERHEAD_ID = 'b9c0e100-8d6c-4b6c-8e6a-081229bd20f0';
export const PAX_LETTERHEAD = {
  ...letterheadSettingsSchema.parse({ name: 'PAX Türkiye kurumsal antet', orientation: 'portrait',
    margins: { top: 12, right: 16, bottom: 12, left: 16 }, safeArea: { top: 25, bottom: 9 },
    showTitle: true, showDate: true, showPageNumbers: true, footerText: '', isDefault: true }),
  id: PAX_LETTERHEAD_ID, mimeType: 'application/pdf' as const, byteSize: 272873,
  updatedAt: '2026-10-19T00:00:00Z', isBuiltin: true,
};

export async function loadPaxLetterhead() {
  const bytes = new Uint8Array(await fs.readFile(path.join(process.cwd(), 'assets', 'report-letterheads', 'pax-turkiye.pdf')));
  return { settings: PAX_LETTERHEAD, bytes, mimeType: 'application/pdf' as const, lockOrientation: true };
}
