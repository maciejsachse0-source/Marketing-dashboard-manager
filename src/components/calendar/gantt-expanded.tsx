import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DeleteProductionButton } from '@/components/productions/delete-production-button';
import { ProductionStepRow } from '@/components/productions/production-step-row';
import { AddStepInline } from '@/components/productions/add-step-inline';
import { T1StartEditor } from '@/components/productions/t1-start-editor';
import { resolveStepSequence } from '@/lib/category-sequence';
import { getFirstPeriodStart } from '@/lib/production-steps';
import { type ProductionStatus, type ProductionStep } from '../../../drizzle/schema';
import { STAGE_CATEGORIES, type GanttRow, type StageCategory } from './gantt-geometry';
import { EXPANDED_FRAMES } from './gantt-frames';


/**
 * Expanded row panel — shown below the row when the user clicks the chevron.
 * Mirrors the structure of the /productions/[id] page (T1/T2/T3 framed cards
 * with category sections, sub-stage buttons and date pickers) so the user gets
 * the same editing surface inline. Files and posts are deliberately skipped —
 * for those the user opens the full production page via the CTA.
 */
export function ExpandedDetails({
  row,
  currentStatus,
  tLabel,
}: {
  row: GanttRow;
  currentStatus: ProductionStatus;
  tLabel: string;
}) {
  const t0Label = row.t0At.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
  const stepDates = row.stepDates ?? {};

  return (
    <div className="border-t border-border/60 bg-muted/20 py-6">
      {/* Sticky-anchored, container-bound width — the gantt strip is min-width
          1900+px and scrolls horizontally inside its overflow container. The
          scroll container is marked `container-type: inline-size`, so `cqw`
          units here resolve to its actual visible width (independent of the
          inner gantt min-width). Sticky pins the panel at left:1rem during
          horizontal scroll; width fills the scroll container minus 2rem on
          each side so T1/T2/T3 sit equally close to both edges. */}
      <div className="sticky left-4 w-[calc(100cqw-2rem)] space-y-6">
        {/* Header: title, T-0 chip + CTA to full production page */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/40">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
              Szczegóły produkcji
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-base font-bold tracking-tight">{row.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                T-0: {t0Label}
              </span>
              <span className="px-1.5 py-0.5 rounded font-medium tabular-nums bg-foreground text-background text-[11px]">
                {tLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DeleteProductionButton
              productionId={row.id}
              productionName={row.artistName ?? row.title}
              redirectTo="/calendar"
            />
            <Link
              href={`/productions/${row.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Otwórz pełną kartę
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* Start produkcji — shifts t0At + every step + every linked calendar
            entry by the chosen Δdays. Same component as /productions/[id]. */}
        <section className="rounded-2xl border-2 border-foreground/10 bg-gradient-to-br from-[var(--accent-blue-tint)] to-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--accent-blue)] font-bold">
              Start produkcji {row.artistName ? `· ${row.artistName}` : ''}
            </div>
            <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">
              Zmień datę startu — <strong>wszystkie kroki, daty i wpisy w kalendarzu</strong> przesuną się razem o tyle samo dni.
            </p>
          </div>
          <T1StartEditor
            productionId={row.id}
            t1Start={getFirstPeriodStart(row.t0At, row.periods)}
            disabled={row.cancelled}
          />
        </section>

        {/* T1 / T2 / T3 framed cards — same visual language as /productions/[id] */}
        <div className="space-y-5">
          {(() => {
            // Compute global step counter across categories so each step's
            // displayNumber matches its corresponding gantt sub-step circle.
            // Iterate categories in canonical order, accumulate sequence length.
            let stepOffset = 0;
            const offsetsByCat = new Map<string, number>();
            for (const cat of STAGE_CATEGORIES) {
              offsetsByCat.set(cat.key, stepOffset);
              stepOffset += resolveStepSequence(row.steps ?? [], cat.key).length;
            }
            return EXPANDED_FRAMES.map((frame) => {
              const weekCategories = STAGE_CATEGORIES.filter((c) => c.frame === frame.code);
              return (
                <div
                  key={frame.code}
                  className={`relative rounded-2xl border ${frame.border} ${frame.bg} p-4 sm:p-5 space-y-4`}
                >
                  <header className="flex items-center gap-2.5 px-1 flex-wrap">
                    <span
                      className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${frame.badge}`}
                    >
                      {frame.code}
                    </span>
                    <span
                      className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${frame.accent}`}
                    >
                      {frame.label}
                    </span>
                    <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                      tydzień {frame.code.replace('T', '')}
                    </span>
                  </header>

                  <div className="space-y-3">
                    {weekCategories.map((cat) => (
                      <ExpandedCategorySection
                        key={cat.key}
                        productionId={row.id}
                        productionT0At={row.t0At}
                        productionPeriods={row.periods}
                        category={cat}
                        steps={row.steps}
                        cancelled={row.cancelled}
                        startNumber={(offsetsByCat.get(cat.key) ?? 0) + 1}
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer hint — full editing surface lives on the production page */}
        <p className="text-[11px] text-muted-foreground italic px-1">
          Pliki, posty i metryki znajdziesz na pełnej karcie produkcji.
        </p>
      </div>
    </div>
  );
}

export function ExpandedCategorySection({
  productionId,
  productionT0At,
  productionPeriods,
  category,
  steps,
  cancelled,
  startNumber,
}: {
  productionId: number;
  productionT0At: Date;
  productionPeriods: import('../../../drizzle/schema').ProductionPeriods | null;
  category: StageCategory;
  steps: ProductionStep[];
  cancelled: boolean;
  /** 1-based global step number for the first item in this category — each
   *  subsequent item uses startNumber + seqIdx. Matches gantt sub-step n. */
  startNumber: number;
}) {
  const stepsInCat = steps.filter((s) => s.category === category.key);
  const passedCount = stepsInCat.filter((s) => !!s.doneAt).length;
  // First non-done step in the WHOLE production is the "active" one — used for
  // tone and the cascade indicator on the row.
  const firstActiveId = steps.find((s) => !s.doneAt)?.id ?? null;
  const groupTone =
    stepsInCat.length === 0
      ? 'pending'
      : passedCount === stepsInCat.length
        ? 'passed'
        : stepsInCat.some((s) => s.id === firstActiveId)
          ? 'active'
          : 'pending';

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden ${
        groupTone === 'active' ? 'border-foreground/40 shadow-sm' : 'border-border'
      }`}
    >
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap bg-muted/30">
        <span
          className={`pill-label pill-label-sm ${
            groupTone === 'passed' ? 'pill-label-blue' : ''
          }`}
        >
          {category.label}
        </span>
        <span className="text-xs text-muted-foreground flex-1 min-w-0">
          {category.description}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums font-medium shrink-0">
          {passedCount}/{stepsInCat.length} kroków
        </span>
      </div>

      <div className="p-4 space-y-3">
        {stepsInCat.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-4 text-center text-[11px] text-muted-foreground">
            Brak kroków w tej kategorii.
          </div>
        ) : (
          stepsInCat.map((step, posInCat) => {
            const canMoveUp = posInCat > 0;
            const canMoveDown = posInCat < stepsInCat.length - 1;
            const state =
              step.doneAt
                ? 'passed'
                : step.id === firstActiveId
                  ? 'active'
                  : 'pending';
            return (
              <ProductionStepRow
                key={step.id}
                productionId={productionId}
                productionT0At={productionT0At}
                productionPeriods={productionPeriods}
                step={step}
                state={state as 'passed' | 'active' | 'pending'}
                displayNumber={startNumber + posInCat}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                productionCancelled={cancelled}
              />
            );
          })
        )}
        <div className="pt-1">
          <AddStepInline productionId={productionId} category={category.key} />
        </div>
      </div>
    </div>
  );
}
