import type { CampaignPhase } from '../../../drizzle/schema';

const COLORS: Record<CampaignPhase, string> = {
  'build-up': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  teaser: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  reveal: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  release: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  afterglow: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  done: 'bg-muted text-muted-foreground border-border',
};

export function PhasePill({ phase }: { phase: CampaignPhase }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${COLORS[phase]}`}
    >
      {phase}
    </span>
  );
}
