import { isProductionDone } from '@/lib/production-steps';
import type {
  CalendarEntry,
  CalendarType,
  Production,
} from '../../../drizzle/schema';

/**
 * Base color per calendar type — used for filter pills + small color dots in
 * the campaign timeline. Tuned for light theme.
 */
export const TYPE_COLOR: Record<CalendarType, string> = {
  shoot: 'bg-amber-200 border-amber-500 text-amber-900',
  edit: 'bg-violet-200 border-violet-500 text-violet-900',
  publish: 'bg-emerald-200 border-emerald-500 text-emerald-900',
  meeting: 'bg-sky-200 border-sky-500 text-sky-900',
  deadline: 'bg-rose-200 border-rose-500 text-rose-900',
};

export const TYPE_PILL: Record<CalendarType, string> = {
  shoot: 'bg-amber-100 text-amber-800 border-amber-300',
  edit: 'bg-violet-100 text-violet-800 border-violet-300',
  publish: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  meeting: 'bg-sky-100 text-sky-800 border-sky-300',
  deadline: 'bg-rose-100 text-rose-800 border-rose-300',
};

export const TYPE_LABEL: Record<CalendarType, string> = {
  shoot: 'Nagranie',
  edit: 'Montaż',
  publish: 'Publikacja',
  meeting: 'Spotkanie',
  deadline: 'Deadline',
};

/**
 * Derived "is there content for this slot yet" state.
 * - planned-empty → calendar slot exists, but no asset/copy attached
 * - content-ready → linked production has reached `approved` (folder generated, copy ready)
 * - done          → entry already executed/published
 * - cancelled     → entry cancelled
 */
export type ContentState = 'planned-empty' | 'content-ready' | 'done' | 'cancelled';

export function getContentState(
  entry: Pick<CalendarEntry, 'status' | 'type' | 'productionId'>,
  production: Pick<Production, 'steps' | 'cancelledAt'> | null | undefined,
): ContentState {
  if (entry.status === 'cancelled') return 'cancelled';
  if (entry.status === 'done') return 'done';
  if (production && !production.cancelledAt && isProductionDone(production.steps ?? [])) {
    return 'content-ready';
  }
  return 'planned-empty';
}

/**
 * Static (type × content-state) → Tailwind class table. Literal so the JIT
 * scanner picks up every class — never build via string concat.
 *
 * Visual hierarchy in light theme:
 * - planned-empty → light fill (50), dashed border, readable text → "slot, czeka na kontent"
 * - content-ready → mid fill (100) + solid border (500) + ring → "kontent gotowy, ❗"
 * - done         → strong fill (200) + solid border (400) → "zaklepane"
 * - cancelled    → very light fill, dashed, line-through, faded
 */
const ENTRY_CLASS: Record<CalendarType, Record<ContentState, string>> = {
  shoot: {
    'planned-empty': 'bg-amber-50 border-2 border-dashed border-amber-300 text-amber-900 hover:bg-amber-100',
    'content-ready': 'bg-amber-100 border-2 border-amber-500 text-amber-950 ring-1 ring-amber-400 shadow-sm hover:bg-amber-200',
    done: 'bg-amber-200 border border-amber-500 text-amber-900 opacity-90',
    cancelled: 'bg-amber-50 border border-dashed border-amber-200 text-amber-700 line-through opacity-60',
  },
  edit: {
    'planned-empty': 'bg-violet-50 border-2 border-dashed border-violet-300 text-violet-900 hover:bg-violet-100',
    'content-ready': 'bg-violet-100 border-2 border-violet-500 text-violet-950 ring-1 ring-violet-400 shadow-sm hover:bg-violet-200',
    done: 'bg-violet-200 border border-violet-500 text-violet-900 opacity-90',
    cancelled: 'bg-violet-50 border border-dashed border-violet-200 text-violet-700 line-through opacity-60',
  },
  publish: {
    'planned-empty': 'bg-emerald-50 border-2 border-dashed border-emerald-300 text-emerald-900 hover:bg-emerald-100',
    'content-ready': 'bg-emerald-100 border-2 border-emerald-500 text-emerald-950 ring-1 ring-emerald-400 shadow-sm hover:bg-emerald-200',
    done: 'bg-emerald-200 border border-emerald-500 text-emerald-900 opacity-90',
    cancelled: 'bg-emerald-50 border border-dashed border-emerald-200 text-emerald-700 line-through opacity-60',
  },
  meeting: {
    'planned-empty': 'bg-sky-50 border-2 border-dashed border-sky-300 text-sky-900 hover:bg-sky-100',
    'content-ready': 'bg-sky-100 border-2 border-sky-500 text-sky-950 ring-1 ring-sky-400 shadow-sm hover:bg-sky-200',
    done: 'bg-sky-200 border border-sky-500 text-sky-900 opacity-90',
    cancelled: 'bg-sky-50 border border-dashed border-sky-200 text-sky-700 line-through opacity-60',
  },
  deadline: {
    'planned-empty': 'bg-rose-50 border-2 border-dashed border-rose-300 text-rose-900 hover:bg-rose-100',
    'content-ready': 'bg-rose-100 border-2 border-rose-500 text-rose-950 ring-1 ring-rose-400 shadow-sm hover:bg-rose-200',
    done: 'bg-rose-200 border border-rose-500 text-rose-900 opacity-90',
    cancelled: 'bg-rose-50 border border-dashed border-rose-200 text-rose-700 line-through opacity-60',
  },
};

export function entryClass(type: CalendarType, state: ContentState): string {
  return ENTRY_CLASS[type][state];
}

export const CONTENT_STATE_LABEL: Record<ContentState, string> = {
  'planned-empty': 'pusty slot',
  'content-ready': 'kontent gotowy',
  done: 'wykonane',
  cancelled: 'anulowane',
};

/** Legend swatches — solid colors so the user can match them visually. */
export const LEGEND_SWATCH: Record<ContentState, string> = {
  'planned-empty': 'bg-emerald-50 border-2 border-dashed border-emerald-300',
  'content-ready': 'bg-emerald-100 border-2 border-emerald-500 ring-1 ring-emerald-400',
  done: 'bg-emerald-200 border border-emerald-500',
  cancelled: 'bg-emerald-50 border border-dashed border-emerald-200',
};
