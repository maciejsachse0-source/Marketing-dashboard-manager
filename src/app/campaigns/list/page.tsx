import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { LayoutTemplate } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { db, schema } from '@/lib/db';
import { NewCampaignButton } from '@/components/campaigns/new-campaign-button';
import { loadMarketingTemplates } from '@/lib/campaign-templates';
import { CampaignsList } from '@/components/campaigns/campaigns-list';

export const dynamic = 'force-dynamic';

export default async function CampaignsListPage() {
  const [campaigns, templates] = await Promise.all([
    db.query.campaigns.findMany({ orderBy: desc(schema.campaigns.releaseAt) }),
    loadMarketingTemplates(),
  ]);

  return (
    <PageShell
      title="Lista kampanii"
      eyebrow="dyspozytornia narracji"
      description={
        <>
          Każda kampania to długofalowa wizja — opowieść, którą widz Twoich artystów ma
          poczuć od pierwszej zapowiedzi po finałowy reveal i afterglow. To nie kalendarz
          jednej premiery, tylko szkielet narracji projektu, w którego ramach pracują
          artyści.
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns/templates"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-border hover:border-foreground/40 ui-transition"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Szablony
          </Link>
          <NewCampaignButton templates={templates} />
        </div>
      }
    >
      <CampaignsList campaigns={campaigns} />
    </PageShell>
  );
}
