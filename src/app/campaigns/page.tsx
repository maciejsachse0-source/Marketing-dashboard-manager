import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { Megaphone, LayoutTemplate, Plus, ArrowRight } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { db, schema } from '@/lib/db';
import { NewCampaignButton } from '@/components/campaigns/new-campaign-button';
import { loadMarketingTemplates } from '@/lib/campaign-templates';
import { CampaignsList } from '@/components/campaigns/campaigns-list';
import { CampaignTemplatesList } from '@/components/campaigns/campaign-templates-list';

export const dynamic = 'force-dynamic';

export default async function CampaignsOverviewPage() {
  const [campaigns, templates] = await Promise.all([
    db.query.campaigns.findMany({ orderBy: desc(schema.campaigns.releaseAt) }),
    loadMarketingTemplates(),
  ]);

  return (
    <PageShell
      title="Kampanie"
      eyebrow="dyspozytornia narracji + biblioteka szablonów"
      description="Aktywne kampanie i szablony narracji — wszystko w jednym miejscu."
      actions={
        <div className="flex items-center gap-2">
          <Link href="/campaigns/templates/new">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Szablon
            </Button>
          </Link>
          <NewCampaignButton templates={templates} />
        </div>
      }
    >
      <div className="space-y-14">
        <section>
          <OverviewHeading
            icon={Megaphone}
            title="Lista kampanii"
            count={campaigns.length}
            href="/campaigns/list"
            ctaLabel="Pełna lista"
          />
          <CampaignsList campaigns={campaigns} />
        </section>

        <section>
          <OverviewHeading
            icon={LayoutTemplate}
            title="Templaty kampanii"
            count={templates.length}
            href="/campaigns/templates"
            ctaLabel="Edytuj szablony"
          />
          <CampaignTemplatesList templates={templates} />
        </section>
      </div>
    </PageShell>
  );
}

function OverviewHeading({
  icon: Icon,
  title,
  count,
  href,
  ctaLabel,
}: {
  icon: typeof Megaphone;
  title: string;
  count: number;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
      <span className="pill-label pill-label-sm">{title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      <div className="flex-1 h-px bg-border" />
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground ui-transition"
      >
        {ctaLabel}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
