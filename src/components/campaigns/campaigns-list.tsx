import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PhasePill } from '@/components/campaigns/phase-pill';
import { resolvePeriods } from '@/lib/production-periods';
import { toneForIndex } from '@/lib/period-tones';
import type { Campaign } from '../../../drizzle/schema';

export function CampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Brak kampanii"
        description={
          <>
            Kliknij &bdquo;+ Nowa kampania&rdquo; — wybierz szablon, ustal kickoff i zacznij
            budować długofalową wizję.
          </>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {campaigns.map((c) => {
        const daysSinceKickoff = Math.round(
          (Date.now() - c.releaseAt.getTime()) / 86400000,
        );
        const milestones = c.milestones ?? [];
        const totalSubs = milestones.reduce((s, m) => s + m.submilestones.length, 0);
        const doneSubs = milestones.reduce(
          (s, m) => s + m.submilestones.filter((sm) => sm.doneAt).length,
          0,
        );
        const doneMilestones = milestones.filter((m) => {
          if (m.submilestones.length > 0) {
            return m.submilestones.every((s) => s.doneAt);
          }
          return !!m.doneAt;
        }).length;
        const progress =
          totalSubs > 0
            ? Math.round((doneSubs / totalSubs) * 100)
            : milestones.length > 0
              ? Math.round((doneMilestones / milestones.length) * 100)
              : 0;

        const periods = resolvePeriods(c.periods);
        const arcLength =
          periods.length > 0
            ? Math.max(0, ...periods.map((p) => p.endOffsetDays)) -
              Math.min(0, ...periods.map((p) => p.startOffsetDays)) +
              1
            : 0;

        return (
          <Link
            key={c.id}
            href={`/campaigns/${c.id}`}
            className="card-editorial p-4 block ui-transition hover:-translate-y-px"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-semibold tracking-tight">{c.name}</div>
              <PhasePill phase={c.phase} />
            </div>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{c.goal}</p>
            <div className="flex items-center gap-3 text-xs mb-3">
              <span className="text-muted-foreground">
                Start: {c.releaseAt.toLocaleDateString('pl-PL', { dateStyle: 'medium' })}
              </span>
              <span
                className={`tabular-nums ${
                  daysSinceKickoff < 0
                    ? 'text-foreground'
                    : daysSinceKickoff <= arcLength
                      ? 'text-emerald-700'
                      : 'text-muted-foreground'
                }`}
              >
                {daysSinceKickoff < 0
                  ? `za ${Math.abs(daysSinceKickoff)}d`
                  : `dzień ${daysSinceKickoff + 1}/${arcLength || '?'}`}
              </span>
              {c.templateSlug ? (
                <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono">
                  {c.templateSlug}
                </span>
              ) : null}
            </div>

            {milestones.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground/70"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                    {progress}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {periods.map((p, idx) => {
                    const inP = milestones.filter((m) => m.period === p.code);
                    if (inP.length === 0) return null;
                    const doneInP = inP.filter((m) => {
                      if (m.submilestones.length > 0) {
                        return m.submilestones.every((s) => s.doneAt);
                      }
                      return !!m.doneAt;
                    }).length;
                    const tone = toneForIndex(idx);
                    return (
                      <span
                        key={p.code}
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${tone.bar} ${tone.ink}`}
                      >
                        <span className="font-bold tracking-wider tabular-nums">{p.code}</span>
                        <span className="opacity-80 tabular-nums">
                          {doneInP}/{inP.length}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                Bez szablonu — brak milestone&apos;ów.
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
