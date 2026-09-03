import type { ProductionStage } from '../../drizzle/schema';

/** Pipeline week frame — same buckets as the gantt T1/T2/T3 bands. */
export type WeekFrame = 'T1' | 'T2' | 'T3';

export const FRAME_FOR_CATEGORY: Record<ProductionStage, WeekFrame> = {
  outreach: 'T1',
  ustalenia: 'T1',
  nagrywanie: 'T2',
  obrobka: 'T2',
  publikacja: 'T3',
};

export const CATEGORY_LABEL: Record<ProductionStage, string> = {
  outreach: 'Outreach',
  ustalenia: 'Ustalenia + scenariusz',
  nagrywanie: 'Nagrywanie',
  obrobka: 'Obróbka',
  publikacja: 'Publikacja',
};

/**
 * Tailwind class bundles per frame — kept in sync with `FRAME_TONE` and
 * `EXPANDED_FRAMES` in gantt-view.tsx so every surface that talks about
 * pipeline categories looks like the gantt strip.
 *
 * Field guide:
 *   - code/label    — frame identifier + the category bundle name shown to user
 *   - bg / border   — section background + hairline (used for category panels)
 *   - badge         — solid pill (T1/T2/T3 indicator), dark background + light ink
 *   - accent        — strong category text colour (uppercase headings)
 *   - chip          — soft pill for "custom step" badges, sits on bg
 *   - dot           — saturated solid colour for marker dots
 *   - faint         — przygaszony tekst kategorii, czytelny na jasnym tle
 *   - glow          — kolorowy cień pod kropką z numerem kroku
 */
export const FRAME_STYLE: Record<
  WeekFrame,
  {
    code: WeekFrame;
    label: string;
    bg: string;
    border: string;
    badge: string;
    accent: string;
    chip: string;
    dot: string;
    faint: string;
    glow: string;
    /** F7-31: obramowanie kółka podkroku na gancie — odcień 400 BEZ
     *  przezroczystości. `border` (400/70 albo 400/55) jest za blady na
     *  kółku 24 px, więc to osobne pole, nie wariant `border`. */
    accentBorder: string;
  }
> = {
  T1: {
    code: 'T1',
    label: 'Outreach + ustalenia',
    bg: 'bg-amber-50/40',
    border: 'border-amber-300/70',
    badge: 'bg-amber-900 text-amber-50',
    accent: 'text-amber-900',
    chip: 'bg-amber-100 text-amber-900 border-amber-300/60',
    dot: 'bg-amber-500',
    faint: 'text-amber-700',
    glow: 'shadow-amber-200/70',
    accentBorder: 'border-amber-400',
  },
  T2: {
    code: 'T2',
    label: 'Nagrywka + obróbka',
    bg: 'bg-violet-50/40',
    border: 'border-violet-300/70',
    badge: 'bg-violet-900 text-violet-50',
    accent: 'text-violet-900',
    chip: 'bg-violet-100 text-violet-900 border-violet-300/60',
    dot: 'bg-violet-500',
    faint: 'text-violet-700',
    glow: 'shadow-violet-200/70',
    accentBorder: 'border-violet-400',
  },
  T3: {
    code: 'T3',
    label: 'Publikacja',
    bg: 'bg-emerald-50/40',
    border: 'border-emerald-300/70',
    badge: 'bg-emerald-900 text-emerald-50',
    accent: 'text-emerald-900',
    chip: 'bg-emerald-100 text-emerald-900 border-emerald-300/60',
    dot: 'bg-emerald-500',
    faint: 'text-emerald-700',
    glow: 'shadow-emerald-200/70',
    accentBorder: 'border-emerald-400',
  },
};
