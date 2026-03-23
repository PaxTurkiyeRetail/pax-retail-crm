import { requireCrmAccessOrThrow } from '@/lib/authz';
import SystemRequirementStamp from '@/components/system/SystemRequirementStamp';
import EmbeddedHtmlPage from '@/components/shared/EmbeddedHtmlPage';

export default async function CrmSalesProcessPage() {
  await requireCrmAccessOrThrow();

  return (
    <div className="pax-page-container">
      <SystemRequirementStamp pageKey="salesProcess" />
      <EmbeddedHtmlPage
        eyebrow="Satış Süreci · PAX Retail Yol Haritası"
        title="Satış Süreci"
        description="PAX Retail yeni müşteri kazanımı, teslimat ve operasyon büyüme akışını CRM içinde rehber olarak görüntüleyin."
        iframeSrc="/sales-process.html"
        iframeTitle="PAX Retail Satış Süreci"
      />
    </div>
  );
}
