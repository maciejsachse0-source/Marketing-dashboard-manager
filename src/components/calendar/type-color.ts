import type { CalendarType } from '../../../drizzle/schema';

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
