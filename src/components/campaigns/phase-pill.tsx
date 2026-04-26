import type { CampaignPhase } from '../../../drizzle/schema';

const COLORS: Record<CampaignPhase, string> = {
  'build-up': 'bg-zinc-100 text-zinc-700 border-zinc-300',
  teaser: 'bg-violet-100 text-violet-800 border-violet-300',
  reveal: 'bg-amber-100 text-amber-800 border-amber-300',
  release: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  afterglow: 'bg-sky-100 text-sky-800 border-sky-300',
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
