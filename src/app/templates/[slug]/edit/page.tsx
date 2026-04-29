import { notFound } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { TemplateForm } from '@/components/templates/template-form';
import { getTemplate } from '@/lib/production-templates';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) notFound();

  return (
    <PageShell
      title={template.name}
      eyebrow="edycja szablonu"
      description={template.summary}
    >
      <TemplateForm mode={{ kind: 'edit', slug: template.slug }} initial={template} />
    </PageShell>
  );
}
