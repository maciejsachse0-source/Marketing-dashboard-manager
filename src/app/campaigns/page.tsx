import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { LayoutTemplate, Megaphone } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { db, schema } from '@/lib/db';
import { PhasePill } from '@/components/campaigns/phase-pill';
import { NewCampaignButton } from '@/components/campaigns/new-campaign-button';
import { EmptyState } from '@/components/empty-state';
import { loadMarketingTemplates } from '@/lib/campaign-templates';
import { resolvePeriods } from '@/lib/production-periods';
import { toneForIndex } from '@/lib/period-tones';

export const dynamic = 'force-dynamic';

export default async function CampaignsListPage() {
  const [campaigns, templates] = await Promise.all([
    db.query.campaigns.findMany({ orderBy: desc(schema.campaigns.releaseAt) }),
    Promise.resolve(loadMarketingTemplates()),
  ]);

  return (
    <PageShell
      title="Kampanie marketingowe"
      eyebrow="dyspozytornia narracji"
      description={
        <>
          Każda kampania to długofalowa wizja — opowieść, którą widz Twoich artystów ma
          poczuć od pierwszej zapowiedzi po finałowy reveal i afterglow. To nie kalendarz
          jednej premiery, tylko szkielet narracji projektu, w którego ramach pracują
          artyści.
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns/templates"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-border hover:border-foreground/40 ui-transition"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Szablony
          </Link>
          <NewCampaignButton templates={templates} />
        </div>
      }
    >
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Brak kampanii"
          description={
            <>
              Kliknij &bdquo;+ Nowa kampania&rdquo; — wybierz szablon, ustal kickoff i
              zacznij budować długofalową wizję.
            </>
          }
        />
      ) : (
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
                    Start:{' '}
                    {c.releaseAt.toLocaleDateString('pl-PL', { dateStyle: 'medium' })}
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
                            <span className="font-bold tracking-wider tabular-nums">
                              {p.code}
                            </span>
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
      )}
    </PageShell>
  );
}
