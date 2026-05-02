import Link from 'next/link';
import { Film, LayoutTemplate, Plus, ArrowRight } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { listProductions } from '@/server/actions/productions';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { NewProductionButton } from '@/components/productions/new-production-button';
import { ProductionsList } from '@/components/productions/productions-list';
import { TemplatesList } from '@/components/templates/templates-list';
import { loadTemplates } from '@/lib/production-templates';

export const dynamic = 'force-dynamic';

export default async function ProductionsOverviewPage() {
  const [productions, artists, videographers] = await Promise.all([
    listProductions(),
    listArtists(),
    listVideographers(),
  ]);
  const templates = loadTemplates();

  const artistOptions = artists.map((a) => ({ id: a.id, name: a.name, handle: a.handle }));
  const videographerOptions = videographers.map((v) => ({
    id: v.id,
    name: v.name,
    hourlyRate: v.hourlyRate,
  }));

  return (
    <PageShell
      title="Produkcje"
      eyebrow="łańcuch produkcji + biblioteka pipeline'ów"
      description="Aktywne produkcje i szablony — wszystko w jednym miejscu."
      actions={
        <div className="flex items-center gap-2">
          <Link href="/templates/new">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Szablon
            </Button>
          </Link>
          <NewProductionButton
            artists={artistOptions}
            videographers={videographerOptions}
            templates={templates}
          />
        </div>
      }
    >
      <div className="space-y-14">
        <section>
          <OverviewHeading
            icon={Film}
            title="Lista produkcji"
            count={productions.length}
            href="/productions/list"
            ctaLabel="Pełna lista z filtrami"
          />
          <ProductionsList
            productions={productions}
            artists={artists}
            videographers={videographers}
          />
        </section>

        <section>
          <OverviewHeading
            icon={LayoutTemplate}
            title="Templaty produkcji"
            count={templates.length}
            href="/templates"
            ctaLabel="Edytuj szablony"
          />
          <TemplatesList templates={templates} />
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
  icon: typeof Film;
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
