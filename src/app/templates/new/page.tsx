// F7-41: layout czyta bazę (agenci) na każde żądanie — prerender przy buildzie odpytuje lokalny docker
export const dynamic = 'force-dynamic';

import { PageShell } from '@/components/page-shell';
import { TemplateForm } from '@/components/templates/template-form';

export default function NewTemplatePage() {
  return (
    <PageShell
      title="Nowy szablon"
      eyebrow="biblioteka pipeline'ów"
      description="Zdefiniuj własny scenariusz produkcji - fundament 9 kanonicznych kroków + dowolna liczba kroków dodatkowych."
    >
      <TemplateForm mode={{ kind: 'create' }} />
    </PageShell>
  );
}
