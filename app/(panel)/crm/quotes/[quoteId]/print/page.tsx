import type { CSSProperties } from 'react';
import { requireCrmAccessOrThrow, isAdminLike } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getQuoteDetailById, formatMoney } from '@/lib/quotes/service';
import { STATIC_QUOTE_PRODUCTS } from '@/lib/quotes/catalog';

function trDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR');
}

export default async function QuotePrintPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const me = await requireCrmAccessOrThrow();
  const { quoteId } = await params;
  const admin = createSupabaseAdminClient();
  const detail = await getQuoteDetailById(admin, quoteId);

  if (!detail) return <main style={{ padding: 24 }}>Teklif bulunamadı.</main>;
  if (!isAdminLike(me.role) && String((detail as any).owner_name ?? '').trim() !== String(me.full_name ?? '').trim()) {
    return <main style={{ padding: 24 }}>Yetki yok.</main>;
  }

  const productMap = new Map(STATIC_QUOTE_PRODUCTS.map((item) => [item.code, item]));
  const selectedProducts = ((detail.items ?? []) as any[])
    .map((item) => productMap.get(String(item.product_code_snapshot ?? '')))
    .filter(Boolean);

  return (
    <main style={{ width: '100%', maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18 }}>
      <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Bu görünüm tarayıcı yazdır menüsü ile PDF olarak kaydedilebilir.</div>
      <section style={{ minHeight: 760, padding: 44, display: 'grid', alignContent: 'space-between', borderRadius: 28, background: 'linear-gradient(135deg,#0f2243 0%,#23408e 58%,#3d6fe0 100%)', color: 'var(--surface)' }}>
        <div>
          <img src="/pax-logo.svg" alt="PAX" style={{ width: 140, filter: 'brightness(0) invert(1)' }} />
          <div style={{ marginTop: 24, fontSize: 14, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .8 }}>PAX Türkiye Teklif Seti</div>
          <h1 style={{ margin: '12px 0 0', fontSize: 38, lineHeight: 1.05, fontWeight: 900 }}>{(detail as any).customer?.musteri}</h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.5, maxWidth: 620 }}>{(detail as any).opportunity_title || 'Ödeme çözümleri teklif seti'}</p>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <InfoRow label="Teklif No" value={String((detail as any).quote_no)} inverse />
          <InfoRow label="Teklif Tarihi" value={trDate((detail as any).proposal_date)} inverse />
          <InfoRow label="Geçerlilik" value={`${trDate((detail as any).valid_until)} · 15 gün`} inverse />
          <InfoRow label="Satışçı" value={String((detail as any).owner_name ?? '-')} inverse />
        </div>
      </section>

      <section style={printSurface}>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Teklif Özeti</h2>
        <p style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>Bu sayfa müşteriye giden ana teklif seti olarak tasarlanmıştır. Sonraki bloklarda seçilen ürünlerin kısa açıklamaları ve ticari detaylar yer alır.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 18 }}>
          <KpiCard label="Toplam cihaz" value={String((detail as any).total_device_count ?? 0)} />
          <KpiCard label="Donanım" value={formatMoney(Number((detail as any).hardware_amount ?? 0))} />
          <KpiCard label="Aylık hizmet" value={`${formatMoney(Number((detail as any).monthly_amount ?? 0))} / ay`} />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
          <thead>
            <tr>{['Ürün', 'Tip', 'Adet', 'Birim Fiyat', 'Toplam'].map((head) => <th key={head} style={{ textAlign: 'left', padding: '0 0 10px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', borderBottom: '1px solid #cbd5e1' }}>{head}</th>)}</tr>
          </thead>
          <tbody>
            {((detail as any).items ?? []).map((item: any) => (
              <tr key={item.id}>
                <td style={printCell}><strong>{item.product_name_snapshot}</strong><div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{item.product_code_snapshot}</div></td>
                <td style={printCell}>{item.is_recurring ? 'Recurring' : 'One-time'}</td>
                <td style={printCell}>{item.quantity}</td>
                <td style={printCell}>{formatMoney(Number(item.unit_price ?? 0))}</td>
                <td style={printCell}>{formatMoney(Number(item.total_price ?? 0))}{item.is_recurring ? ' / ay' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={printSurface}>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Seçilen Ürünler</h2>
        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {selectedProducts.length ? selectedProducts.map((product) => (
            <div key={product!.code} style={{ border: '1px solid var(--border)', borderRadius: 20, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6366f1', fontWeight: 800 }}>{product!.category}</div>
                  <h3 style={{ margin: '8px 0 0', fontSize: 22 }}>{product!.name}</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-2)' }}>{product!.description}</p>
                </div>
                <div style={{ minWidth: 140, borderRadius: 18, background: '#eef2ff', color: '#4338ca', padding: '12px 14px', fontWeight: 800 }}>{product!.product_type}</div>
              </div>
              <ul style={{ margin: '16px 0 0', paddingLeft: 18, color: 'var(--text-2)', lineHeight: 1.8 }}>
                {product!.specs.map((spec) => <li key={spec}>{spec}</li>)}
              </ul>
            </div>
          )) : <div style={{ marginTop: 20, color: 'var(--text-3)' }}>Seçili ürün görsel kartı bulunamadı.</div>}
        </div>
      </section>

      <section style={printSurface}>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Diğer Şartlar</h2>
        <ul style={{ marginTop: 18, paddingLeft: 20, lineHeight: 1.9, color: 'var(--text-2)' }}>
          <li>Yukarıdaki fiyatlara KDV dahil değildir.</li>
          <li>Saha hizmetleri projelere ve fiyatlamalara dahil değildir.</li>
          <li>Ödeme şekli peşindir.</li>
          <li>Ürünler, kullanıcı hataları, pil ve adaptör hariç 2 yıl garanti kapsamındadır.</li>
          <li>Standart teslimat süresi sipariş onayı sonrası yaklaşık 12 haftadır.</li>
          <li>Teklif, teklif tarihinden itibaren 15 gün geçerlidir.</li>
        </ul>
        <div style={{ paddingTop: 24, borderTop: '1px solid var(--border)', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>PAX Türkiye</div>
          <div style={{ color: 'var(--text-3)' }}>info@paxturkiye.com · www.paxturkiye.com</div>
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value, inverse = false }: { label: string; value: string; inverse?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 14, background: inverse ? 'rgba(255,255,255,.1)' : 'var(--surface-2)', color: inverse ? 'var(--surface)' : 'var(--text)' }}><span style={{ opacity: .8 }}>{label}</span><strong>{value}</strong></div>;
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return <div style={{ borderRadius: 18, border: '1px solid var(--border)', padding: 16, background: 'var(--surface-2)' }}><div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-3)' }}>{label}</div><div style={{ marginTop: 10, fontSize: 24, fontWeight: 900 }}>{value}</div></div>;
}

const printSurface: CSSProperties = { minHeight: 760, padding: 32, borderRadius: 28, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 18px 48px rgba(15,23,42,.08)' };
const printCell: CSSProperties = { padding: '14px 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
