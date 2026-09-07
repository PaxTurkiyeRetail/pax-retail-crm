import { z } from 'zod';
import type { AllowedUser, OwnedResource } from '@/lib/authz';
import { isResourceOwner } from '@/lib/resource-ownership';
import { userHasPermission } from '@/lib/permissions';

const optionalText = (max: number) => z.string().trim().max(max).nullable().transform(v => v || null);
export const technicalContactFields = z.object({
  full_name: z.string().trim().min(1, 'Ad Soyad gereklidir.').max(160),
  phone: z.string().trim().max(40).regex(/^[+\d\s().-]*$/, 'Telefon numarasını kontrol edin.').nullable().transform(v => v || null),
  email: z.string().trim().pipe(z.union([z.literal(''), z.email().max(254)])).nullable().transform(v => v ? v.toLowerCase() : null),
  title: optionalText(120),
});
export const createTechnicalContactSchema = technicalContactFields.extend({ customer_id: z.uuid() });
export const updateTechnicalContactSchema = technicalContactFields.partial().extend({
  id: z.uuid(), customer_id: z.uuid(), expected_version: z.number().int().positive(), is_active: z.boolean().optional(),
}).refine(v => ['full_name', 'phone', 'email', 'title', 'is_active'].some(k => k in v), 'Güncellenecek alan yok.');

export type TechnicalContact = {
  id: string; customer_id: string; full_name: string; phone: string | null;
  email: string | null; title: string | null; is_active: boolean; version: number;
};

export function canReadTechnicalContacts(user: AllowedUser, customer: OwnedResource) {
  const owner = isResourceOwner(user, customer);
  return (userHasPermission(user, 'customer.read') && (userHasPermission(user, 'customer.read.any') || owner))
    || ((userHasPermission(user, 'activity.create') || userHasPermission(user, 'activity.read'))
      && (userHasPermission(user, 'activity.read.any') || owner));
}

export function canManageTechnicalContacts(user: AllowedUser, customer: OwnedResource) {
  return canReadTechnicalContacts(user, customer) && (userHasPermission(user, 'customer.update.any')
    || (userHasPermission(user, 'customer.update.own') && isResourceOwner(user, customer)));
}
