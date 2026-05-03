import { notFound } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { CampaignTemplateForm } from '@/components/campaigns/campaign-template-form';
import { getMarketingTemplate } from '@/lib/campaign-templates';

export const dynamic = 'force-dynamic';

export default async function EditCampaignTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = await getMarketingTemplate(slug);
  if (!template) notFound();

  return (
    <PageShell
      title={template.name}
      eyebrow="edycja szablonu kampanii"
      description={template.summary}
    >
      <CampaignTemplateForm mode={{ kind: 'edit', slug: template.slug }} initial={template} />
    </PageShell>
  );
}
