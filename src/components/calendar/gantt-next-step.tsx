import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { type SubStepInfo } from './gantt-substep-bar';


/**
 * Next-step indicator card — the "what do I do next?" answer at a glance.
 * Three states: cancelled (rose), all-done (emerald), next-step (frame-tinted).
 *
 * Visual: card with a thin colored left rail (frame T1/T2/T3 = amber/violet/
 * emerald). Focal point is the step name in the dark accent ink — not the
 * band background. A small numbered dot (frame-colored) on the left tells the
 * user which step in the sequence is up. Frame label is demoted to a single-
 * line caption to avoid the "label-over-label" feel of the prior pill stack.
 */
export function NextStepIndicator({
  productionId,
  cancelled,
  allDone,
  nextStep,
  totalSteps,
}: {
  productionId: number;
  cancelled: boolean;
  allDone: boolean;
  nextStep: SubStepInfo | null;
  totalSteps: number;
}) {
  if (cancelled) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-rose-200 bg-rose-50/70 px-3 py-2 animate-fade-in">
        <span className="grid place-items-center w-9 h-9 rounded-full bg-rose-500 text-white text-base font-bold shadow-sm shrink-0">
          ×
        </span>
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-rose-700">
          Anulowane
        </span>
      </div>
    );
  }
  if (allDone) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/70 px-3 py-2 animate-scale-in">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" strokeWidth={2.5} />
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-800">
          Wszystkie kroki gotowe
        </span>
      </div>
    );
  }
  if (!nextStep) return null;

  // Frame-keyed accents — left rail + numbered dot tinted to T1/T2/T3 so the
  // user can spot which band the upcoming step lives in without reading the
  // caption.
  const frameAccent = {
    T1: { rail: 'bg-amber-500', dot: 'bg-amber-500 text-white', ink: 'text-amber-950', faint: 'text-amber-700', glow: 'shadow-amber-200/70' },
    T2: { rail: 'bg-violet-500', dot: 'bg-violet-500 text-white', ink: 'text-violet-950', faint: 'text-violet-700', glow: 'shadow-violet-200/70' },
    T3: { rail: 'bg-emerald-500', dot: 'bg-emerald-500 text-white', ink: 'text-emerald-950', faint: 'text-emerald-700', glow: 'shadow-emerald-200/70' },
  }[nextStep.frame];

  return (
    <Link
      key={`${nextStep.kind}:${nextStep.stage ?? nextStep.customId}`}
      href={`/productions/${productionId}`}
      className="relative rounded-xl border-2 border-border bg-card pl-4 pr-3 py-2.5 flex items-center gap-3 hover:border-foreground/40 hover:shadow-lg hover:-translate-y-0.5 ui-transition group/next animate-fade-up no-underline"
      title={`${nextStep.cat.label}, krok ${nextStep.n}/${totalSteps}: ${nextStep.label}`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[4px] rounded-full ${frameAccent.rail} ui-transition group-hover/next:top-1 group-hover/next:bottom-1`}
      />
      <span
        className={`grid place-items-center w-10 h-10 rounded-full text-base font-bold tabular-nums shrink-0 ${frameAccent.dot} shadow-md ${frameAccent.glow} ui-transition group-hover/next:scale-105`}
      >
        {nextStep.n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
            Następny krok
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground/70 font-semibold">
            {nextStep.n}/{totalSteps}
          </span>
        </div>
        <div className={`text-base font-bold leading-tight truncate ${frameAccent.ink}`}>
          {nextStep.label}
        </div>
        <div className={`text-xs leading-tight mt-1 truncate font-medium ${frameAccent.faint}`}>
          {nextStep.cat.label}
        </div>
      </div>
      <ArrowRight
        className={`w-5 h-5 shrink-0 ${frameAccent.faint} ui-transition group-hover/next:translate-x-0.5`}
        strokeWidth={2.5}
      />
    </Link>
  );
}
