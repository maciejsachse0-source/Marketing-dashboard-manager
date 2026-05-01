'use client';

import { useTransition } from 'react';
import { Check, Circle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { toggleCampaignMilestone } from '@/server/actions/campaigns';
import { toneForIndex } from '@/lib/period-tones';
import { resolvePeriods, type TemplatePeriod } from '@/lib/production-periods';
import type { CampaignMilestones } from '../../../drizzle/schema';

export function MilestonesTracker({
  campaignId,
  milestones,
  periods,
}: {
  campaignId: number;
  milestones: CampaignMilestones;
  /** Periods owned by the campaign — drives bucket order, codes, and tone
   *  matching with the slider above. Falls back to defaults if absent. */
  periods?: TemplatePeriod[] | null;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = (milestoneId: string, submilestoneId?: string) => {
    if (pending) return;
    startTransition(async () => {
      try {
        await toggleCampaignMilestone(campaignId, milestoneId, submilestoneId);
      } catch (e) {
        toast.error('Nie udało się zmienić stanu', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const totalSubs = milestones.reduce((s, m) => s + m.submilestones.length, 0);
  const doneSubs = milestones.reduce(
    (s, m) => s + m.submilestones.filter((sm) => sm.doneAt).length,
    0,
  );
  const doneMain = milestones.filter((m) => {
    if (m.submilestones.length > 0) return m.submilestones.every((s) => s.doneAt);
    return !!m.doneAt;
  }).length;
  const totalMain = milestones.length;

  const resolved = resolvePeriods(periods);
  // Build the ordered list of period codes the campaign uses, plus collect any
  // milestone-side codes that don't appear there (legacy / orphan) into a
  // separate bucket so nothing gets silently dropped.
  const orderedCodes: string[] = resolved.map((p) => p.code);
  const orphanCodes = Array.from(
    new Set(milestones.map((m) => m.period).filter((c) => !orderedCodes.includes(c))),
  );

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
            Kamienie milowe
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doneMain}/{totalMain} milestone&apos;ów ·{' '}
            {totalSubs > 0 ? `${doneSubs}/${totalSubs} submilestone'ów` : "bez submilestone'ów"}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {totalSubs > 0
            ? `${Math.round((doneSubs / totalSubs) * 100)}% sub.`
            : `${totalMain > 0 ? Math.round((doneMain / totalMain) * 100) : 0}% main`}
        </span>
      </header>

      <div className="space-y-3">
        {orderedCodes.map((code, idx) => {
          const inP = milestones.filter((m) => m.period === code);
          if (inP.length === 0) return null;
          const tone = toneForIndex(idx);
          return (
            <PeriodBucket
              key={code}
              code={code}
              tone={tone}
              milestones={inP}
              pending={pending}
              onToggle={toggle}
            />
          );
        })}
        {orphanCodes.map((code) => {
          const inP = milestones.filter((m) => m.period === code);
          // Orphan codes pick a stable tone derived from string hash so two
          // legacy campaigns aren't both colored amber.
          const idx =
            (code.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 6) + orderedCodes.length;
          const tone = toneForIndex(idx);
          return (
            <PeriodBucket
              key={code}
              code={code}
              tone={tone}
              milestones={inP}
              pending={pending}
              onToggle={toggle}
              orphan
            />
          );
        })}
      </div>
    </section>
  );
}

function PeriodBucket({
  code,
  tone,
  milestones,
  pending,
  onToggle,
  orphan,
}: {
  code: string;
  tone: { bg: string; bar: string; thumb: string; ink: string };
  milestones: CampaignMilestones;
  pending: boolean;
  onToggle: (milestoneId: string, submilestoneId?: string) => void;
  orphan?: boolean;
}) {
  const doneInP = milestones.filter((m) => {
    if (m.submilestones.length > 0) return m.submilestones.every((s) => s.doneAt);
    return !!m.doneAt;
  }).length;
  return (
    <div className={`rounded-2xl border-2 border-border ${tone.bg} p-4 space-y-2.5`}>
      <header className="flex items-center gap-2.5">
        <span
          className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${tone.bar} ${tone.ink}`}
        >
          {code}
        </span>
        <span className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${tone.ink}`}>
          Okres {code}
          {orphan ? (
            <span className="ml-2 text-[9px] uppercase tracking-[0.12em] text-amber-700/80 normal-case">
              (poza obecnym timeline&apos;m — usuń lub zmień period)
            </span>
          ) : null}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {doneInP}/{milestones.length}
        </span>
      </header>

      <ol className="space-y-2">
        {milestones.map((m) => {
          const allSubsDone =
            m.submilestones.length > 0 && m.submilestones.every((s) => s.doneAt);
          const someSubsDone =
            m.submilestones.length > 0 &&
            m.submilestones.some((s) => s.doneAt) &&
            !allSubsDone;
          const directlyDone = m.submilestones.length === 0 && !!m.doneAt;
          const isDone = allSubsDone || directlyDone;
          const isMixed = someSubsDone;

          return (
            <li
              key={m.id}
              className={`rounded-lg border bg-card transition ${isDone ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    if (m.submilestones.length === 0) onToggle(m.id);
                  }}
                  disabled={pending || m.submilestones.length > 0}
                  className={`mt-0.5 grid place-items-center w-5 h-5 rounded-full border-2 shrink-0 ui-transition ${
                    isDone
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : isMixed
                        ? 'bg-amber-100 border-amber-400 text-amber-700'
                        : 'bg-card border-border text-transparent hover:border-foreground/40'
                  } ${m.submilestones.length === 0 ? 'cursor-pointer' : 'cursor-default'}`}
                  title={
                    m.submilestones.length > 0
                      ? "Stan zależny od submilestone'ów"
                      : isDone
                        ? 'Odznacz'
                        : 'Zaznacz jako zrobione'
                  }
                  aria-label="Toggle milestone"
                >
                  {isDone ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : isMixed ? (
                    <MinusCircle className="w-3 h-3" strokeWidth={2.5} />
                  ) : (
                    <Circle className="w-3 h-3" strokeWidth={2} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold leading-snug ${isDone ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {m.label}
                  </div>
                  {m.description ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {m.description}
                    </p>
                  ) : null}
                </div>
              </div>

              {m.submilestones.length > 0 ? (
                <ul className="border-t border-border/60 px-3 py-2 space-y-1.5">
                  {m.submilestones.map((s) => {
                    const sDone = !!s.doneAt;
                    return (
                      <li key={s.id} className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => onToggle(m.id, s.id)}
                          disabled={pending}
                          className={`mt-0.5 grid place-items-center w-4 h-4 rounded-md border-2 shrink-0 ui-transition ${
                            sDone
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'bg-card border-border text-transparent hover:border-foreground/40 cursor-pointer'
                          }`}
                          title={sDone ? 'Odznacz' : 'Zaznacz jako zrobione'}
                          aria-label="Toggle submilestone"
                        >
                          {sDone ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-xs leading-snug ${sDone ? 'line-through text-muted-foreground' : ''}`}
                          >
                            {s.label}
                          </div>
                          {s.description ? (
                            <p className="text-[10.5px] text-muted-foreground/80 mt-0.5 leading-relaxed">
                              {s.description}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
