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
