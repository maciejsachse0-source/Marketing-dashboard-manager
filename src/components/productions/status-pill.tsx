import type { ProductionStatus } from '../../../drizzle/schema';

const STATUS_COLORS: Record<ProductionStatus, string> = {
  idea: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  planning: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  outreach: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  confirmed: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  briefing: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  'ready-to-shoot': 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  shooting: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  editing: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  review: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  publishing: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  published: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  analyzed: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
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
          ? 'bg-pink-500/15 text-pink-300 border-pink-500/40'
          : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
      }`}
    >
      {type === 'with-artist' ? 'z artystą' : 'solo'}
    </span>
  );
}
