// Section frames for the row's expanded panel — derived from the shared
// FRAME_STYLE table so the gantt and the templates page stay color-synced.
import { FRAME_STYLE, type WeekFrame } from '@/lib/category-colors';
import { type WeekFrameCode } from './gantt-geometry';

export const EXPANDED_FRAMES: { code: WeekFrame; label: string; border: string; bg: string; badge: string; accent: string }[] =
  (['T1', 'T2', 'T3'] as const).map((code) => {
    const f = FRAME_STYLE[code];
    return { code, label: f.label, border: f.border, bg: f.bg, badge: f.badge, accent: f.accent };
  });


// Wyciszone tła pasów (100/55) zamiast 200/70 — pasy nadal czytelnie kodują
// fazę, ale nie konkurują z krokami nad nimi. Ramki cieńsze (border zamiast
// border-2) i mniej nasycone (400/50). Mocne kolory (500) zostają dla
// chip-pinów i passed-stanów — tam liczy się kontrast vs. tła.
export const FRAME_TONE: Record<
  WeekFrameCode,
  { bg: string; border: string; ink: string; chip: string; passed: string; active: string; pending: string }
> = {
  T1: {
    bg: 'bg-amber-100/55',
    border: 'border-amber-400/55',
    ink: 'text-amber-900',
    chip: 'bg-amber-200/80 border-amber-400',
    passed: 'bg-amber-500 border-amber-600 text-white',
    active: 'bg-amber-50 border-amber-500 ring-4 ring-amber-300/50 text-amber-900',
    pending: 'bg-white border-amber-300 hover:border-amber-500 text-amber-700',
  },
  T2: {
    bg: 'bg-violet-100/55',
    border: 'border-violet-400/55',
    ink: 'text-violet-900',
    chip: 'bg-violet-200/80 border-violet-400',
    passed: 'bg-violet-500 border-violet-600 text-white',
    active: 'bg-violet-50 border-violet-500 ring-4 ring-violet-300/50 text-violet-900',
    pending: 'bg-white border-violet-300 hover:border-violet-500 text-violet-700',
  },
  T3: {
    bg: 'bg-emerald-100/55',
    border: 'border-emerald-400/55',
    ink: 'text-emerald-900',
    chip: 'bg-emerald-200/80 border-emerald-400',
    passed: 'bg-emerald-500 border-emerald-600 text-white',
    active: 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-300/50 text-emerald-900',
    pending: 'bg-white border-emerald-300 hover:border-emerald-500 text-emerald-700',
  },
};

// F7-13: klasy kółka podkroku. Mieszkają tu razem z FRAME_TONE, bo są tym
// samym rodzajem wiedzy — jak pas T wygląda — i bo `gantt-substep-bar.tsx`
// nie może urosnąć ponad swoje 293 linie (zasada Z11).
export function accentBorderFor(frame: WeekFrameCode): string {
  return FRAME_STYLE[frame].accentBorder;
}

export function stepCircleClass(args: {
  state: 'passed' | 'active' | 'pending';
  tonePassed: string;
  accentBorder: string;
  isCustom: boolean;
  cancelled: boolean;
  isHovered: boolean;
}): string {
  const { state, tonePassed, accentBorder, isCustom, cancelled, isHovered } = args;
  // Custom circles use slightly-thinner border + dashed outline when
  // pending, to telegraph "this is an inserted, user-defined step".
  const customRing = isCustom ? 'ring-1 ring-offset-1 ring-offset-background ring-foreground/15' : '';
  const size =
    state === 'passed'
      ? `w-6 h-6 ${tonePassed} hover:scale-110 shadow-sm`
      : state === 'active'
        ? `w-7 h-7 bg-foreground text-background ring-2 ring-offset-1 ring-offset-background scale-110 shadow`
        : `w-6 h-6 bg-card border-2 ${isCustom ? 'border-dashed' : ''} ${accentBorder} text-muted-foreground hover:border-foreground/60 hover:scale-110`;
  return `disabled:opacity-100 absolute z-20 grid place-items-center rounded-full p-0 border-0 bg-clip-border text-[11px] font-bold tabular-nums transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
    cancelled ? 'opacity-50 disabled:opacity-50 cursor-not-allowed' : 'cursor-pointer'
  } ${customRing} ${size} ${isHovered && state !== 'active' ? 'ring-2 ring-foreground/20' : ''}`;
}
