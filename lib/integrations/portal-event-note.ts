// PAX Portal olayı → CRM aktivite notu. Route dosyası yalnız HTTP handler export edebildiği için burada.
const BACKFILL_PREFIX = '[Portal geçmiş aktarımı] ';

export const PORTAL_EVENT_TYPE_LABELS = {
  'partner.registered': 'Portal kaydı oluşturuldu',
  'partner.profile_completed': 'Portal profili tamamlandı',
  'partner.line_granted': 'Ürün hattı erişimi verildi',
  'partner.line_revoked': 'Ürün hattı erişimi kaldırıldı',
  'partner.artifact_downloaded': 'SDK/paket indirildi',
} as const;
const LINE_LABELS = { A2A: 'A2A', D2D_DLL: 'D2D-DLL', D2D_JAR: 'D2D-JAR' } as const;

export type PortalEventNoteInput = {
  type: keyof typeof PORTAL_EVENT_TYPE_LABELS;
  productLine?: keyof typeof LINE_LABELS | null;
  version?: string | null;
  title?: string | null;
  backfill: boolean;
};

export function portalEventNote(event: PortalEventNoteInput) {
  const prefix = event.backfill ? BACKFILL_PREFIX : '';
  // İndirmede doküman/dosya adı varsa açıkça yazılır: "<ad> · sürüm <v> indirildi".
  if (event.type === 'partner.artifact_downloaded' && event.title) {
    return `${prefix}${event.title}${event.version ? ` · sürüm ${event.version}` : ''} indirildi (Portal)`;
  }
  const parts: string[] = [PORTAL_EVENT_TYPE_LABELS[event.type]];
  if (event.productLine) parts.push(LINE_LABELS[event.productLine]);
  if (event.version) parts.push(`sürüm ${event.version}`);
  return `${prefix}${parts.join(' · ')} (Portal)`;
}
