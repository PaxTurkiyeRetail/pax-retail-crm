import { z } from 'zod';
import { SERVICE_CURRENCIES } from '@/lib/sales/service-invoices-shared';

// Hizmet faturası API gövdesi (create / update ortak). Route dosyaları yalnız handler dışa
// aktarabildiği için şema burada durur.
export const serviceInvoiceSchema = z.object({
  customer_id: z.string().uuid('Müşteri seçilmeli.'),
  period_month: z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Dönem (ay) geçersiz.'),
  currency: z.enum(SERVICE_CURRENCIES),
  invoice_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  invoice_no: z.string().trim().max(60).nullish(),
  owner_name: z.string().trim().max(120).nullish(),
  note: z.string().trim().max(1000).nullish(),
  lines: z.array(z.object({
    service_key: z.string().trim().min(1, 'Hizmet seçilmeli.').max(120),
    quantity: z.number().int().min(1).max(100000),
    unit_price: z.number().min(0).max(1_000_000_000),
  })).min(1, 'En az bir kalem girilmeli.').max(100),
});

export const serviceInvoiceUpdateSchema = serviceInvoiceSchema.partial({ customer_id: true }).extend({ id: z.string().uuid() });
