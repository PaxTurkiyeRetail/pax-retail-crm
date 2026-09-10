export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requirePermissionOrThrow, userHasPermission } from '@/lib/authz';
import { createPgAdminClient } from '@/lib/pg/admin';
import { getQuoteCatalog } from '@/lib/quotes/service';
import { isReportOnlyCustomer } from '@/lib/report-only-customers';
import { db } from '@/lib/db';
import { OWNER_ORDER, normalizeName, ownerOrderCompare } from '@/lib/reports/live-board-shared';

// "+ Satış Ekle" penceresinin seçenekleri (027). Müşteri listesi YETKİYE GÖRE daraltılır:
// satışçı yalnız kendi portföyündeki firmaları görür — API zaten 403 veriyor, ama listede
// görünüp kaydederken hata almak kötü deneyim. Yönetici (quote.update.any) tümünü görür.
// Ürün ve fiyat kuralları teklif ekranıyla aynı kaynaktan (Ürün & Fiyat Yönetimi).
// `owners`: satışın satışçısı düzenlenebilir (Sinan, 10.09). Liste = OWNER_ORDER (satış ekibi +
// kullanıcı olmayan sabit sahipler: İş Ortakları, Havuz Account, Yemek Kartları). Rol tablosundan
// türetilmez — ikincil rolü account_manager olan yönetici hesapları (genel müdür) listeye girmez
// (kılavuz kural 32; aynı hata Müşteri Listesi ve Hedefler'de yaşandı).
export async function GET() {
  try {
    const me = await requirePermissionOrThrow('sale.create');
    const isManager = userHasPermission(me, 'quote.update.any');
    const admin = createPgAdminClient();

    let customerQuery = admin.from('musteriler').select('id,musteri,sektor,sorumlu,entegrasyon_tipi').order('musteri', { ascending: true }).limit(2000);
    if (!isManager) customerQuery = customerQuery.eq('owner_user_id', me.id);

    const [{ products }, customerRes, ownerRes] = await Promise.all([
      getQuoteCatalog(admin),
      customerQuery,
      db.query<{ id: string; name: string }>(
        `select u.id::text as id, coalesce(nullif(trim(u.full_name), ''), u.email) as name
         from public.allowed_users u
         where u.is_active = true
           and (u.role = 'account_manager' or 'account_manager' = any(coalesce(u.secondary_roles, '{}'::text[])))`,
      ),
    ]);
    if (customerRes.error) return NextResponse.json({ message: customerRes.error.message }, { status: 500 });

    const salesTeam = ownerRes.rows
      .filter((row) => OWNER_ORDER.some((known) => normalizeName(known) === normalizeName(row.name)))
      .map((row) => ({ id: row.id as string | null, name: row.name }));
    const fixedOwners = OWNER_ORDER.filter((name) => !salesTeam.some((row) => normalizeName(row.name) === normalizeName(name)))
      .map((name) => ({ id: null as string | null, name }));
    const owners = [...salesTeam, ...fixedOwners].sort((a, b) => ownerOrderCompare(a.name, b.name));

    return NextResponse.json(
      {
        isManager,
        owners,
        customers: (customerRes.data ?? [])
          .filter((row: any) => !isReportOnlyCustomer(row))
          .map((row: any) => ({ id: String(row.id), musteri: String(row.musteri) })),
        products: products.map((product: any) => ({
          id: String(product.id), code: String(product.code ?? ''), name: String(product.name ?? ''),
          product_type: String(product.product_type ?? 'device'), is_recurring: Boolean(product.is_recurring),
          rental_monthly_price: product.rental_monthly_price == null ? null : Number(product.rental_monthly_price),
        })),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Yetkisiz' }, { status: e?.status || 401 });
  }
}
