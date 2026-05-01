import Link from 'next/link';
import { LayoutTemplate, Pencil, Plus, ListChecks } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { loadMarketingTemplates } from '@/lib/campaign-templates';
import type { MarketingTemplate } from '@/lib/campaign-templates-types';
import { resolvePeriods } from '@/lib/production-periods';
import { toneForIndex } from '@/lib/period-tones';
import { CampaignTemplateRowActions } from '@/components/campaigns/campaign-template-row-actions';

export const dynamic = 'force-dynamic';

export default function CampaignTemplatesPage() {
  const templates = loadMarketingTemplates();

  return (
    <PageShell
      title="Templaty kampanii"
      eyebrow="biblioteka kampanii marketingowych"
      description={
        <>
          Predefiniowane scenariusze narracji — każdy szablon zawiera konfigurowalny
          timeline (T1..Tn) i kamienie milowe budujące napięcie. Wybierasz jeden szablon
          przy tworzeniu kampanii i staje się on jej kręgosłupem.
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
      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Brak szablonów"
          description={
            <>
              Kliknij &bdquo;+ Nowy szablon&rdquo; — zdefiniujesz strukturę narracji
              kampanii: ile okresów, jak długie, z jakimi milestone&apos;ami.
            </>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {templates.map((t) => (
            <CampaignTemplateCard key={t.slug} template={t} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function CampaignTemplateCard({ template }: { template: MarketingTemplate }) {
  const milestones = template.milestones;
  const totalSubs = milestones.reduce((s, m) => s + m.submilestones.length, 0);
  const periods = resolvePeriods(template.periods);

  return (
    <article className="card-editorial p-6 flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-foreground text-background grid place-items-center shrink-0">
          <ListChecks className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold tracking-tight leading-tight">{template.name}</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{template.summary}</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0 text-right leading-snug">
          {milestones.length} milestone&apos;ów
          <br />
          {totalSubs} sub.
        </span>
      </header>

      <div className="space-y-3">
        {periods.map((period, idx) => {
          const inPeriod = milestones.filter((m) => m.period === period.code);
          if (inPeriod.length === 0) return null;
          const tone = toneForIndex(idx);
          const length = period.endOffsetDays - period.startOffsetDays + 1;

          return (
            <div
              key={period.code}
              className={`rounded-lg border-2 border-border px-3 py-2.5 ${tone.bg}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded text-[10px] font-bold tracking-[0.16em] tabular-nums ${tone.bar} ${tone.ink}`}
                  >
                    {period.code}
                  </span>
                  <span className={`text-[11px] uppercase tracking-[0.14em] font-bold ${tone.ink}`}>
                    {length} {length === 1 ? 'dzień' : 'dni'}
                  </span>
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {inPeriod.length} milestone&apos;ów
                </span>
              </div>
              <ol className="space-y-1.5">
                {inPeriod.map((m) => (
                  <li key={m.id} className="text-[12px]">
                    <div className="font-semibold leading-snug">{m.label}</div>
                    {m.submilestones.length > 0 ? (
                      <ul className="mt-0.5 ml-3 flex flex-wrap gap-1">
                        {m.submilestones.map((s) => (
                          <li
                            key={s.id}
                            className="inline-flex items-center text-[10.5px] px-1.5 py-0.5 rounded border bg-background border-border text-foreground/75"
                          >
                            {s.label}
                          </li>
                        ))}
                      </ul>
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
          href={`/campaigns/templates/${template.slug}/edit`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-[var(--accent-blue)] ui-transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edytuj
        </Link>
        <CampaignTemplateRowActions slug={template.slug} name={template.name} />
      </footer>
    </article>
  );
}
