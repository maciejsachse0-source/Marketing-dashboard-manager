import type { ProductionStatus } from '../../../drizzle/schema';

const STATUS_COLORS: Record<ProductionStatus, string> = {
  idea: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  planning: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  outreach: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-amber-100 text-amber-800 border-amber-300',
  briefing: 'bg-violet-100 text-violet-800 border-violet-300',
  'ready-to-shoot': 'bg-violet-100 text-violet-800 border-violet-300',
  shooting: 'bg-violet-100 text-violet-800 border-violet-300',
  editing: 'bg-violet-100 text-violet-800 border-violet-300',
  review: 'bg-blue-100 text-blue-800 border-blue-300',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  publishing: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  published: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  analyzed: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-300',
};

export const STATUS_LABEL: Record<ProductionStatus, string> = {
  idea: 'pomysł',
  planning: 'planowanie',
  outreach: 'outreach',
  confirmed: 'potwierdzone',
  briefing: 'brief',
  'ready-to-shoot': 'do nagrania',
  shooting: 'nagrywanie',
  editing: 'montaż',
  review: 'akceptacja',
  approved: 'zaakceptowane',
  publishing: 'do publikacji',
  published: 'opublikowane',
  analyzed: 'przeanalizowane',
  cancelled: 'anulowane',
};

export function ProductionStatusPill({ status }: { status: ProductionStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProductionTypeBadge({ type }: { type: 'with-artist' | 'solo' }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${
        type === 'with-artist'
          ? 'bg-pink-100 text-pink-800 border-pink-300'
          : 'bg-sky-100 text-sky-800 border-sky-300'
      }`}
    >
      {type === 'with-artist' ? 'z artystą' : 'solo'}
    </span>
  );
}
