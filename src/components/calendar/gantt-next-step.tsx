import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { FRAME_STYLE } from '@/lib/category-colors';
import { type SubStepInfo } from './gantt-substep-bar';


/**
 * Next-step indicator card — the "what do I do next?" answer at a glance.
 * Three states: cancelled (rose), all-done (emerald), next-step (frame-tinted).
 *
 * Visual: card with a full frame-tinted border (T1/T2/T3). Zasada Z8 zakazuje
 * lewego paska akcentu, więc pasmo koduje pełne obramowanie, kolor kropki
 * z numerem kroku i kolor podpisu kategorii. Kolory idą z `FRAME_STYLE`
 * (`src/lib/category-colors.ts`), jedynego źródła prawdy o barwach T1/T2/T3,
 * a nie z klas `amber-500` wpisanych na miejscu.
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

  // Frame-keyed accents — obramowanie, kropka i podpis kategorii tinted do
  // T1/T2/T3, żeby użytkownik rozpoznał pasmo bez czytania podpisu.
  const frame = FRAME_STYLE[nextStep.frame];

  return (
    <Link
      key={`${nextStep.kind}:${nextStep.stage ?? nextStep.customId}`}
      href={`/productions/${productionId}`}
      className={`relative rounded-xl border-2 ${frame.border} bg-card px-3 py-2.5 flex items-center gap-3 hover:border-foreground/40 hover:shadow-lg hover:-translate-y-0.5 ui-transition group/next animate-fade-up no-underline`}
      title={`${nextStep.cat.label}, krok ${nextStep.n}/${totalSteps}: ${nextStep.label}`}
    >
      <span
        className={`grid place-items-center w-10 h-10 rounded-full text-base font-bold tabular-nums shrink-0 ${frame.dot} text-white shadow-md ${frame.glow} ui-transition group-hover/next:scale-105`}
      >
        {nextStep.n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="label-micro-wider font-bold text-muted-foreground">
            Następny krok
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground/70 font-semibold">
            {nextStep.n}/{totalSteps}
          </span>
        </div>
        <div className={`text-base font-bold leading-tight truncate ${frame.accent}`}>
          {nextStep.label}
        </div>
        <div className={`text-xs leading-tight mt-1 truncate font-medium ${frame.faint}`}>
          {nextStep.cat.label}
        </div>
      </div>
      <ArrowRight
        className={`w-5 h-5 shrink-0 ${frame.faint} ui-transition group-hover/next:translate-x-0.5`}
        strokeWidth={2.5}
      />
    </Link>
  );
}
