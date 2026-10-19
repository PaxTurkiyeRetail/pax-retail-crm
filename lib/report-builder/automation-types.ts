import { z } from 'zod';

export const automationSchema = z.object({
  pageId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['delivery', 'alert']),
  intervalHours: z.number().int().min(1).max(720),
  firstRunAt: z.string().datetime(),
  format: z.enum(['csv', 'pdf']).default('pdf'),
  active: z.boolean().default(true),
  alert: z.object({ widgetId: z.string().min(1).max(80), column: z.string().min(1).max(80), op: z.enum(['gt','gte','lt','lte']), threshold: z.number().finite() }).optional(),
}).refine(v => v.kind !== 'alert' || !!v.alert, { message: 'Alarm için metrik ve eşik gerekli' });
export type AutomationInput = z.infer<typeof automationSchema>;
export type Automation = {
  id: string; page_id: string; owner_user_id: string; name: string; kind: 'delivery'|'alert';
  interval_hours: number; next_run_at: string; format: 'csv'|'pdf'; is_active: boolean;
  config: { alert?: AutomationInput['alert']; permissionCeiling?: string[] }; last_condition: boolean; last_status: string | null;
};
export function matchesThreshold(value: number, op: 'gt'|'gte'|'lt'|'lte', threshold: number) {
  return op === 'gt' ? value > threshold : op === 'gte' ? value >= threshold : op === 'lt' ? value < threshold : value <= threshold;
}
export function backgroundRoles(legacyRole:string,hasAdHistory:boolean,activeAdRoles:unknown):string[] {
  if(!hasAdHistory)return [legacyRole];
  if(!Array.isArray(activeAdRoles)||!activeAdRoles.length)throw Object.assign(new Error('AD oturumu sona erdi; plan sahibi yeniden giriş yapmalı'),{status:403});
  return activeAdRoles.filter((r):r is string=>typeof r==='string');
}
