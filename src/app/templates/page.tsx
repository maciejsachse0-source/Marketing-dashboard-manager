import Link from 'next/link';
import { LayoutTemplate, Pencil, Plus } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { loadTemplates } from '@/lib/production-templates';
import {
  CATEGORY_LABEL,
  FRAME_FOR_CATEGORY,
  FRAME_STYLE,
} from '@/lib/category-colors';
import type { ProductionTemplate } from '@/lib/production-templates-types';
import { TemplateRowActions } from '@/components/templates/template-row-actions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import type { ProductionStage } from '../../../drizzle/schema';

export const dynamic = 'force-dynamic';

const CATEGORY_ORDER: ProductionStage[] = [
  'outreach',
  'ustalenia',
  'nagrywanie',
  'obrobka',
  'publikacja',
];

export default function TemplatesPage() {
  const templates = loadTemplates();
  const withArtist = templates.filter((t) => t.type === 'with-artist');
  const solo = templates.filter((t) => t.type === 'solo');

  return (
    <PageShell
      title="Templaty"
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
      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Brak szablonów"
          description='Kliknij „+ Nowy szablon" — zdefiniujesz własny scenariusz pipeline, a kreator nowej produkcji zaproponuje go do wyboru.'
        />
      ) : (
        <div className="space-y-10">
          {withArtist.length > 0 ? (
            <section>
              <SectionHeading title="Z artystą" count={withArtist.length} />
              <div className="grid lg:grid-cols-2 gap-5">
                {withArtist.map((t) => (
                  <TemplateCard key={t.slug} template={t} />
                ))}
              </div>
            </section>
          ) : null}

          {solo.length > 0 ? (
            <section>
              <SectionHeading title="Solo" count={solo.length} />
              <div className="grid lg:grid-cols-2 gap-5">
                {solo.map((t) => (
                  <TemplateCard key={t.slug} template={t} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="pill-label pill-label-sm">{title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count} {count === 1 ? 'szablon' : 'szablony'}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function TemplateCard({ template }: { template: ProductionTemplate }) {
  const totalSteps = template.steps.length;

  return (
    <article className="card-editorial p-6 flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-foreground text-background grid place-items-center shrink-0">
          <LayoutTemplate className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold tracking-tight leading-tight">{template.name}</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{template.description}</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0">
          {totalSteps} kroków
        </span>
      </header>

      <div className="space-y-3">
        {CATEGORY_ORDER.map((cat) => {
          const stepsInCat = template.steps.filter((s) => s.category === cat);
          if (stepsInCat.length === 0) return null;
          const frame = FRAME_FOR_CATEGORY[cat];
          const tone = FRAME_STYLE[frame];

          return (
            <div
              key={cat}
              className={`rounded-lg border-2 px-3 py-2.5 ${tone.border} ${tone.bg}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded text-[10px] font-bold tracking-[0.16em] tabular-nums ${tone.badge}`}
                  >
                    {frame}
                  </span>
                  <span className={`text-[11px] uppercase tracking-[0.14em] font-bold ${tone.accent}`}>
                    {CATEGORY_LABEL[cat]}
                  </span>
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {stepsInCat.length} {stepsInCat.length === 1 ? 'krok' : 'kroków'}
                </span>
              </div>
              <ol className="flex flex-wrap gap-1.5">
                {stepsInCat.map((step) => (
                  <li
                    key={step.id}
                    className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border bg-background border-border text-foreground/80"
                  >
                    {step.label}
                    {step.isT0Anchor ? (
                      <span
                        className={`ml-0.5 text-[9px] font-bold tabular-nums px-1 py-0 rounded ${tone.badge}`}
                        title="Krok-kotwica T-0"
                      >
                        T0
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <footer className="flex items-center justify-between gap-3 pt-3 border-t border-border">
        <Link
          href={`/templates/${template.slug}/edit`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-[var(--accent-blue)] ui-transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edytuj
        </Link>
        <TemplateRowActions slug={template.slug} name={template.name} />
      </footer>
    </article>
  );
}
