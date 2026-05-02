import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { loadMarketingTemplates } from '@/lib/campaign-templates';
import { CampaignTemplatesList } from '@/components/campaigns/campaign-templates-list';

export const dynamic = 'force-dynamic';

export default async function CampaignTemplatesPage() {
  const templates = await loadMarketingTemplates();

  return (
    <PageShell
      title="Templaty kampanii"
      eyebrow="biblioteka kampanii marketingowych"
      description={
        <>
          Predefiniowane scenariusze narracji — każdy szablon zawiera konfigurowalny timeline
          (T1..Tn) i kamienie milowe budujące napięcie. Wybierasz jeden szablon przy tworzeniu
          kampanii i staje się on jej kręgosłupem.
        </>
      }
      actions={
        <Link href="/campaigns/templates/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nowy szablon
          </Button>
        </Link>
      }
    >
      <CampaignTemplatesList templates={templates} />
    </PageShell>
  );
}
