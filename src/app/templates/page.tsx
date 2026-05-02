import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { loadTemplates } from '@/lib/production-templates';
import { Button } from '@/components/ui/button';
import { TemplatesList } from '@/components/templates/templates-list';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const templates = loadTemplates();

  return (
    <PageShell
      title="Templaty produkcji"
      eyebrow="biblioteka pipeline'ów"
      description={
        <>
          Predefiniowane scenariusze produkcji — każdy zawiera fundament 9 kanonicznych kroków
          (od pierwszego maila do publikacji) plus opcjonalne kroki dodatkowe dopasowane do typu
          pracy. Edytuj istniejące lub stwórz własny.
        </>
      }
      actions={
        <Link href="/templates/new">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nowy szablon
          </Button>
        </Link>
      }
    >
      <TemplatesList templates={templates} />
    </PageShell>
  );
}
