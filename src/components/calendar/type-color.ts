import type {
  CalendarEntry,
  CalendarType,
  Production,
  ProductionStatus,
} from '../../../drizzle/schema';

/** Base color per calendar type (used as the visual hue for filter pills + week tiles). */
export const TYPE_COLOR: Record<CalendarType, string> = {
  shoot: 'bg-amber-500/20 border-amber-500/60 text-amber-100 hover:bg-amber-500/30',
  edit: 'bg-violet-500/20 border-violet-500/60 text-violet-100 hover:bg-violet-500/30',
  publish: 'bg-emerald-500/20 border-emerald-500/60 text-emerald-100 hover:bg-emerald-500/30',
  meeting: 'bg-sky-500/20 border-sky-500/60 text-sky-100 hover:bg-sky-500/30',
  deadline: 'bg-rose-500/20 border-rose-500/60 text-rose-100 hover:bg-rose-500/30',
};

export const TYPE_PILL: Record<CalendarType, string> = {
  shoot: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  edit: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  publish: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  meeting: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  deadline: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
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

const READY_STATUSES = new Set<ProductionStatus>([
  'approved',
  'publishing',
  'published',
  'analyzed',
]);

export function getContentState(
  entry: Pick<CalendarEntry, 'status' | 'type' | 'productionId'>,
  production: Pick<Production, 'status'> | null | undefined,
): ContentState {
  if (entry.status === 'cancelled') return 'cancelled';
  if (entry.status === 'done') return 'done';
  if (production && READY_STATUSES.has(production.status)) return 'content-ready';
  return 'planned-empty';
}

/**
 * Static (type × content-state) → Tailwind class table. Has to be literal so
 * Tailwind's JIT scanner picks up every class — never build via string concat.
 */
const ENTRY_CLASS: Record<CalendarType, Record<ContentState, string>> = {
  shoot: {
    'planned-empty': 'bg-amber-500/8 border border-dashed border-amber-500/50 text-amber-100/90 hover:bg-amber-500/15',
    'content-ready': 'bg-amber-500/35 border border-amber-400 text-amber-50 ring-1 ring-inset ring-amber-300/40 shadow-sm hover:bg-amber-500/45',
    done: 'bg-amber-500/25 border border-amber-500/70 text-amber-100 opacity-90 ring-1 ring-inset ring-foreground/10',
    cancelled: 'bg-amber-500/10 border border-dashed border-amber-500/40 text-amber-200/60 line-through opacity-60',
  },
  edit: {
    'planned-empty': 'bg-violet-500/8 border border-dashed border-violet-500/50 text-violet-100/90 hover:bg-violet-500/15',
    'content-ready': 'bg-violet-500/35 border border-violet-400 text-violet-50 ring-1 ring-inset ring-violet-300/40 shadow-sm hover:bg-violet-500/45',
    done: 'bg-violet-500/25 border border-violet-500/70 text-violet-100 opacity-90 ring-1 ring-inset ring-foreground/10',
    cancelled: 'bg-violet-500/10 border border-dashed border-violet-500/40 text-violet-200/60 line-through opacity-60',
  },
  publish: {
    'planned-empty': 'bg-emerald-500/8 border border-dashed border-emerald-500/50 text-emerald-100/90 hover:bg-emerald-500/15',
    'content-ready': 'bg-emerald-500/35 border border-emerald-400 text-emerald-50 ring-1 ring-inset ring-emerald-300/40 shadow-sm hover:bg-emerald-500/45',
    done: 'bg-emerald-500/25 border border-emerald-500/70 text-emerald-100 opacity-90 ring-1 ring-inset ring-foreground/10',
    cancelled: 'bg-emerald-500/10 border border-dashed border-emerald-500/40 text-emerald-200/60 line-through opacity-60',
  },
  meeting: {
    'planned-empty': 'bg-sky-500/8 border border-dashed border-sky-500/50 text-sky-100/90 hover:bg-sky-500/15',
    'content-ready': 'bg-sky-500/35 border border-sky-400 text-sky-50 ring-1 ring-inset ring-sky-300/40 shadow-sm hover:bg-sky-500/45',
    done: 'bg-sky-500/25 border border-sky-500/70 text-sky-100 opacity-90 ring-1 ring-inset ring-foreground/10',
    cancelled: 'bg-sky-500/10 border border-dashed border-sky-500/40 text-sky-200/60 line-through opacity-60',
  },
  deadline: {
    'planned-empty': 'bg-rose-500/8 border border-dashed border-rose-500/50 text-rose-100/90 hover:bg-rose-500/15',
    'content-ready': 'bg-rose-500/35 border border-rose-400 text-rose-50 ring-1 ring-inset ring-rose-300/40 shadow-sm hover:bg-rose-500/45',
    done: 'bg-rose-500/25 border border-rose-500/70 text-rose-100 opacity-90 ring-1 ring-inset ring-foreground/10',
    cancelled: 'bg-rose-500/10 border border-dashed border-rose-500/40 text-rose-200/60 line-through opacity-60',
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
