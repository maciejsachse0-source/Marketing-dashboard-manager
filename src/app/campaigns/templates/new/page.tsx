import { PageShell } from '@/components/page-shell';
import { CampaignTemplateForm } from '@/components/campaigns/campaign-template-form';

export const dynamic = 'force-dynamic';

export default function NewCampaignTemplatePage() {
  return (
    <PageShell
      title="Nowy szablon kampanii"
      eyebrow="biblioteka kampanii marketingowych"
      description="Zdefiniuj własną strukturę kampanii: T1/T2/T3 + dowolna liczba kamieni milowych z submilestone'ami."
    >
      <CampaignTemplateForm mode={{ kind: 'create' }} />
    </PageShell>
  );
}
