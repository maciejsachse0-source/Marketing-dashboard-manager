import Link from 'next/link';
import { Film, Clock } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { listProductionTemplates } from '@/lib/templates';
import { loadRhythm } from '@/lib/rhythm';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const productionTemplates = listProductionTemplates();
  const rhythm = loadRhythm();

  return (
    <PageShell
      title="Templates"
      description="Wzorce produkcyjne (workflow) i rytm tygodniowy."
    >
      <div className="space-y-8">
        <section>
          <SectionHeader icon={Clock} title="Rytm tygodniowy" />
          <Link
            href="/templates/rhythm"
            className="block rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{rhythm.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{rhythm.description}</div>
              </div>
              <span className="text-2xl font-semibold tabular-nums">{rhythm.slots.length}</span>
            </div>
          </Link>
        </section>

        <section>
          <SectionHeader icon={Film} title={`Produkcyjne (${productionTemplates.length})`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productionTemplates.map((t) => (
              <div
                key={t.slug}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-medium">{t.name}</div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.type === 'with-artist' ? 'z artystą' : 'solo'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
                <div className="text-xs text-muted-foreground">
                  {t.steps.length} kroków · {t.durationDays} dni
                </div>
                <code className="text-[10px] text-muted-foreground/60 font-mono">{t.slug}.json</code>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Templates żyją w <code className="font-mono">data/templates/</code> jako JSON-y. Edytuj
          w edytorze, refresh strony — zmiany live.
        </p>
      </div>
    </PageShell>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4" strokeWidth={1.5} />
      {title}
    </h2>
  );
}
