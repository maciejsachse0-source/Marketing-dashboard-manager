/**
 * Słownik etapów produkcji: kategorie pipeline'u, ich kolejność i domyślne
 * położenia kroków względem poniedziałku tygodnia T-0. Przeniesione bez zmiany
 * treści z `gantt-geometry.ts` w F2-02, żeby żaden nowy plik nie przekraczał
 * 300 linii (zasada Z11).
 */
import {
  PRODUCTION_PROGRESSION,
  type ProductionStage,
  type ProductionStatus,
} from '../../../drizzle/schema';

export type DateMode = 'record' | 'calendar' | 'derived' | 'none';

export type WeekFrameCode = 'T1' | 'T2' | 'T3';

/**
 * 5 main pipeline checkpoints — anchored on the LAST sub-stage of each category.
 * Date for each checkpoint comes EXCLUSIVELY from the production:
 *   - stepDates[endStage] when the user has recorded a date on the production page
 *   - shooting + 1 day for `editing` (auto-derived, matches production page)
 *   - row.t0At for `publishing` (publication date == T-0)
 *   - otherwise: TENTATIVE — milestone rendered at default offset for visual
 *     orientation, but with dashed border and no date, signalling "ustaw na produkcji"
 */
export type StageCategory = {
  key: ProductionStage;
  label: string;
  short: string;
  description: string;
  hint: string;
  endStage: ProductionStatus;
  subStages: ProductionStatus[];
  frame: WeekFrameCode;
  dateMode: DateMode;
  dateLabel: string;
  withTime: boolean;
};

export const STAGE_CATEGORIES: StageCategory[] = [
  {
    key: 'outreach',
    label: 'Outreach',
    short: 'OUTR.',
    description: 'Kontakt z artystą, akceptacja warunków, ustalenie daty z kamerzystą.',
    hint: 'wzorce maila, screen rozmowy, umowa.pdf',
    endStage: 'cam-meeting-set',
    subStages: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
    frame: 'T1',
    dateMode: 'record',
    dateLabel: 'kiedy się wydarzyło',
    withTime: false,
  },
  {
    key: 'ustalenia',
    label: 'Ustalenia + scenariusz',
    short: 'UST.',
    description: 'Przekazanie daty + omówienie i wysłanie scenariusza.',
    hint: 'scenariusz PDF, shotlist, packing list, callsheet',
    endStage: 'script-sent',
    subStages: ['cam-date-shared', 'script-discussed', 'script-sent'],
    frame: 'T1',
    dateMode: 'calendar',
    dateLabel: 'termin',
    withTime: true,
  },
  {
    key: 'nagrywanie',
    label: 'Nagrywanie',
    short: 'NAGR.',
    description: 'Nagrywki — w studio lub w terenie.',
    hint: 'surówki, BTS, audio raw',
    endStage: 'shooting',
    subStages: ['shooting'],
    frame: 'T2',
    dateMode: 'calendar',
    dateLabel: 'data nagrań',
    withTime: true,
  },
  {
    key: 'obrobka',
    label: 'Obróbka',
    short: 'MONT.',
    description: 'Montaż — następnego dnia po nagrywkach.',
    hint: 'wersje robocze, master video',
    endStage: 'editing',
    subStages: ['editing'],
    frame: 'T2',
    dateMode: 'derived',
    dateLabel: 'auto: dzień po nagrywkach',
    withTime: true,
  },
  {
    key: 'publikacja',
    label: 'Publikacja',
    short: 'PUB.',
    description: 'Upload na platformy.',
    hint: 'thumbs, exports per platforma',
    endStage: 'publishing',
    subStages: ['publishing'],
    frame: 'T3',
    dateMode: 'none',
    dateLabel: '',
    withTime: false,
  },
];

// Section frames for the row's expanded panel — derived from the shared

export function deriveEditingIso(shootIso: string): string {
  const d = new Date(shootIso);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export function subStageState(
  stage: ProductionStatus,
  current: ProductionStatus,
): 'passed' | 'active' | 'pending' {
  if (current === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[current];
  const idx = STAGE_INDEX[stage];
  if (idx < cur) return 'passed';
  if (idx === cur) return 'active';
  return 'pending';
}

/**
 * TENTATIVE milestone positions — relative to MONDAY of T-0's week (t0Mon).
 * Layout requirement: T1/T2/T3 each = 1 week; OUTR.+UST. inside T1, NAGR.+MONT.
 * inside T2, PUB. inside T3. Defaults spread the two ticks across each band:
 *
 *   T1 (t0Mon-14 .. t0Mon-8)  →  OUTR. on Wed,  UST. on Sat
 *   T2 (t0Mon-7  .. t0Mon-1)  →  NAGR. on Wed, MONT. on Fri
 *   T3 (t0Mon    .. t0Mon+6)  →  PUB.  on T-0 (real day, always set)
 */
export const TENTATIVE_OFFSET_FROM_T0_MON: Partial<Record<ProductionStatus, number>> = {
  // T1 — outreach (steps 1-3)
  'email-sent': -14, // Mon of T1
  'terms-accepted': -13, // Tue of T1
  'cam-meeting-set': -12, // Wed of T1 (Outreach milestone end)
  // T1 — ustalenia (steps 4-6)
  'cam-date-shared': -11, // Thu of T1
  'script-discussed': -10, // Fri of T1
  'script-sent': -9, // Sat of T1 (Ustalenia milestone end)
  // T2 — nagrywanie + obróbka (steps 7-8)
  shooting: -5, // Wed of T2
  editing: -3, // Fri of T2
  // T3 — publikacja (step 9)
  publishing: 0, // Mon of T3 (= T-0)
};

export const STAGE_INDEX: Record<ProductionStatus, number> = Object.fromEntries(
  PRODUCTION_PROGRESSION.map((s, i) => [s, i]),
) as Record<ProductionStatus, number>;

/** Map of legacy canonical stages → their T-period code, used by tentative
 *  placement to clamp default offsets to user-customised period bounds. */
export const STAGE_TO_PERIOD: Partial<Record<ProductionStatus, WeekFrameCode>> = {
  'email-sent': 'T1',
  'terms-accepted': 'T1',
  'cam-meeting-set': 'T1',
  'cam-date-shared': 'T1',
  'script-discussed': 'T1',
  'script-sent': 'T1',
  shooting: 'T2',
  editing: 'T2',
  publishing: 'T3',
};
