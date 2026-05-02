'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ChevronDown, ExternalLink, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  resolvePeriods,
  type TemplatePeriod,
} from '@/lib/production-periods';
import { fmtDayMonth, toneForIndex } from '@/lib/period-tones';
import { addDays } from '@/lib/dates';
import { deleteCampaign } from '@/server/actions/campaigns';
import { PhaseButtons } from '@/components/campaigns/phase-buttons';
import { PhasePill } from '@/components/campaigns/phase-pill';
import {
  CampaignNameField,
  CampaignGoalField,
  CampaignNotesField,
} from '@/components/campaigns/campaign-inline-fields';
import { CampaignPeriodsEditor } from '@/components/campaigns/campaign-periods-editor';
import type { CampaignPhase } from '../../../drizzle/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

export type GanttNarrativeCampaign = {
  id: number;
  name: string;
  kickoffAt: Date;
  periods: TemplatePeriod[] | null | undefined;
  goal: string;
  phase: CampaignPhase;
  notes: string | null;
};

/**
 * One-row narrative strip rendered inside the calendar gantt header. Mirrors
 * the bands from the campaign-detail timeline so the user sees the same
 * narrative shape (Build-up, Reveal, Premiera, Afterglow…) directly above
 * the production rows it influences. Each band carries the period name +
 * dates + free-text description so the narration is self-contained — no
 * milestone pins, no counters, just the storytelling intent.
 *
 * Periods that fall outside the visible window get clipped at the edges;
 * if every band lies offscreen we render an "off-window" preview chip
 * strip on the matching edge so the bands never silently disappear.
 *
 * The chevron in the left rail mirrors the production-row chevron — clicking
 * it expands an inline editing panel below the strip with name/goal/phase/
 * notes/periods so the user can tweak the campaign without leaving the gantt.
 */
export function CampaignGanttNarrativeRow({
  campaign,
  firstDay,
  totalDays,
}: {
  campaign: GanttNarrativeCampaign;
  /** Gantt window start (a Monday). All positioning is computed against
   *  this anchor, NOT the campaign kickoff — bars must align with the
   *  gantt's day grid. */
  firstDay: Date;
  totalDays: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const resolved = resolvePeriods(campaign.periods);

  const dayIdxFromDate = (d: Date) =>
    (d.getTime() - firstDay.getTime()) / DAY_MS;
  const pctFromDate = (d: Date) => (dayIdxFromDate(d) / totalDays) * 100;

  const kickoffPct = pctFromDate(campaign.kickoffAt);
  const kickoffInWindow = kickoffPct >= 0 && kickoffPct <= 100;

  // Earliest band start / latest band end across the resolved periods. Used
  // to detect when the entire arc sits outside the visible window so we can
  // render an "off-window" preview at the closest edge instead of an empty
  // row that only shows the campaign name.
  const arcStart = addDays(campaign.kickoffAt, Math.min(0, ...resolved.map((p) => p.startOffsetDays)));
  const arcEnd = addDays(
    campaign.kickoffAt,
    Math.max(0, ...resolved.map((p) => p.endOffsetDays)) + 1,
  );
  const arcStartPct = pctFromDate(arcStart);
  const arcEndPct = pctFromDate(arcEnd);
  const arcFullyBeforeWindow = arcEndPct <= 0;
  const arcFullyAfterWindow = arcStartPct >= 100;
  const offWindow = arcFullyBeforeWindow || arcFullyAfterWindow;

  return (
    <div className="border-b border-border/50">
      <div
        className="grid bg-muted/10"
        style={{ gridTemplateColumns: `22rem 1fr` }}
      >
        <div className="px-5 py-3 border-r border-border/40 sticky left-0 z-30 bg-background/95 backdrop-blur shadow-[2px_0_6px_-2px_rgb(0_0_0_/_0.08)] flex flex-col gap-1 justify-center">
          <div className="flex items-start gap-1">
            <Link
              href={`/campaigns/${campaign.id}`}
              className="flex-1 block text-sm font-bold tracking-tight truncate hover:underline"
              title={`Kampania ${campaign.name} — otwórz szczegóły`}
            >
              {campaign.name}
            </Link>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 p-1 rounded-md hover:bg-muted active:scale-90 ui-transition text-muted-foreground hover:text-foreground"
              aria-expanded={expanded}
              aria-label={expanded ? 'Zwiń kampanię' : 'Rozwiń kampanię'}
              title={expanded ? 'Zwiń kampanię' : 'Rozwiń kampanię'}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums flex items-center gap-2">
            <PhasePill phase={campaign.phase} />
            <span>
              kickoff {campaign.kickoffAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="relative h-24">
          {/* period bands — saturated, full-height, with name + dates + free-
           *  text description always rendered so the user reads the narrative
           *  arc at a glance. Description is the period — no milestone pins
           *  or counters to crowd it out. Clipped to the gantt window edges;
           *  for fully off-window arcs the preview below renders an edge chip
           *  strip so bars never silently disappear. */}
          <div className="absolute inset-0 overflow-hidden">
            {resolved.map((p, idx) => {
              const tone = toneForIndex(idx);
              const startDate = addDays(campaign.kickoffAt, p.startOffsetDays);
              const endDate = addDays(campaign.kickoffAt, p.endOffsetDays + 1);
              const leftPct = pctFromDate(startDate);
              const rightPct = pctFromDate(endDate);
              const clippedLeft = Math.max(0, leftPct);
              const clippedRight = Math.min(100, rightPct);
              if (clippedRight <= 0 || clippedLeft >= 100) return null;
              const width = clippedRight - clippedLeft;

              return (
                <div
                  key={p.code}
                  className={`absolute top-1 bottom-1 ${tone.bar} ${tone.ink} border-r border-background/40 px-2 py-1.5 overflow-hidden rounded-sm shadow-sm`}
                  style={{ left: `${clippedLeft}%`, width: `${width}%` }}
                  title={`${p.code}${p.name ? ` · ${p.name}` : ''}: ${fmtDayMonth(startDate)} → ${fmtDayMonth(addDays(campaign.kickoffAt, p.endOffsetDays))}${p.description ? `\n\n${p.description}` : ''}`}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-black tracking-[0.16em] tabular-nums opacity-90">
                      {p.code}
                    </span>
                    {p.name ? (
                      <span className="text-xs font-bold tracking-tight truncate">
                        {p.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[9px] tabular-nums opacity-75 mt-0.5 truncate">
                    {fmtDayMonth(startDate)} → {fmtDayMonth(addDays(campaign.kickoffAt, p.endOffsetDays))}
                  </div>
                  {p.description ? (
                    <div className="text-[10px] leading-snug opacity-95 mt-1 line-clamp-2">
                      {p.description}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Off-window preview — when every band clips away (campaign starts
           *  after the visible window or ended before it), show a clear chip
           *  strip on the matching edge so the user STILL sees the phase
           *  names + start date. Without this the row would render only the
           *  campaign name on the left and an empty strip on the right. */}
          {offWindow ? (
            <div
              className={`absolute top-1 bottom-1 flex items-center gap-1.5 px-2 ${arcFullyAfterWindow ? 'right-0 flex-row' : 'left-0 flex-row-reverse'}`}
            >
              <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground whitespace-nowrap">
                {arcFullyAfterWindow
                  ? `start ${campaign.kickoffAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} →`
                  : `← zakończona ${arcEnd.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}`}
              </span>
              <div className="flex items-center gap-1">
                {resolved.map((p, idx) => {
                  const tone = toneForIndex(idx);
                  return (
                    <span
                      key={`off-${p.code}`}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${tone.bar} ${tone.ink} text-[10px] font-bold tracking-tight`}
                      title={`${p.code} · ${p.name ?? ''}${p.description ? `\n\n${p.description}` : ''}`}
                    >
                      <span className="tabular-nums opacity-80">{p.code}</span>
                      {p.name ? <span>{p.name}</span> : null}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* kickoff vertical line */}
          {kickoffInWindow ? (
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/70 pointer-events-none"
              style={{ left: `${kickoffPct}%` }}
              title={`Kickoff kampanii ${campaign.name}: ${campaign.kickoffAt.toLocaleDateString('pl-PL')}`}
            />
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="animate-fade-up">
          <ExpandedCampaignDetails campaign={campaign} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline campaign editor — mirrors the production-row expand panel: header
 * with primary CTA + delete on the right, then a stack of editable fields.
 * For the milestones tracker the user still goes to the full campaign page
 * via the "Otwórz pełną kartę" CTA — keeps this panel focused on the
 * narrative-level fields the gantt actually visualises.
 */
function ExpandedCampaignDetails({ campaign }: { campaign: GanttNarrativeCampaign }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t0Days = Math.round(
    (campaign.kickoffAt.getTime() - Date.now()) / DAY_MS,
  );
  const tLabel = t0Days === 0 ? 'T-0' : t0Days > 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`;
  const t0Label = campaign.kickoffAt.toLocaleString('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const onDelete = () => {
    if (pending) return;
    const ok = confirm(
      `Usunąć kampanię „${campaign.name}"?\n\nTej operacji nie można cofnąć. Powiązane wpisy w kalendarzu i posty zostaną odpięte (nie usunięte).`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteCampaign(campaign.id);
        router.refresh();
      } catch (e) {
        console.error('[delete-campaign] failed', e);
        alert('Nie udało się usunąć kampanii. Spróbuj ponownie.');
      }
    });
  };

  return (
    <div className="border-t border-border/60 bg-muted/20 py-6">
      <div className="sticky left-4 w-[calc(100cqw-2rem)] space-y-6">
        {/* Header — same shape as production expand: title + T-0 chip on the
         *  left, delete + open-full-page on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/40">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
              Szczegóły kampanii
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-base font-bold tracking-tight">
                {campaign.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                T-0: {t0Label}
              </span>
              <span className="px-1.5 py-0.5 rounded font-medium tabular-nums bg-foreground text-background text-[11px]">
                {tLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-200 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-50 hover:border-rose-400 hover:shadow-sm hover:shadow-rose-200/50 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ui-transition"
              title={`Usuń kampanię "${campaign.name}"`}
            >
              <Trash2
                className="w-3.5 h-3.5 ui-transition group-hover:rotate-[-6deg] group-hover:scale-110"
                strokeWidth={2.25}
              />
              {pending ? 'Usuwam…' : 'Usuń kampanię'}
            </button>
            <Link
              href={`/campaigns/${campaign.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Otwórz pełną kartę
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* Editable fields — name, goal, phase, notes. Inline-edit components
         *  are the same primitives the campaign detail page uses, so changes
         *  made here propagate through the same server action. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <FieldGroup label="Nazwa">
              <CampaignNameField id={campaign.id} name={campaign.name} />
            </FieldGroup>
            <FieldGroup label="Cel">
              <CampaignGoalField id={campaign.id} goal={campaign.goal} />
            </FieldGroup>
          </div>
          <div className="space-y-3">
            <FieldGroup label="Faza">
              <PhaseButtons id={campaign.id} current={campaign.phase} />
            </FieldGroup>
            <FieldGroup label="Notatki">
              <CampaignNotesField id={campaign.id} notes={campaign.notes} />
            </FieldGroup>
          </div>
        </div>

        {/* Periods editor — same component as the campaign detail page so
         *  drags here update the band shape live (the row above re-renders
         *  on save). Standalone state inside this component is fine — the
         *  parent re-fetches on save through router.refresh(). */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold mb-3">
            Pasy narracji (T1, T2, …)
          </div>
          <CampaignPeriodsEditor
            campaignId={campaign.id}
            initialPeriods={campaign.periods}
            kickoffAt={campaign.kickoffAt}
          />
        </div>

        <p className="text-[11px] text-muted-foreground italic px-1">
          Kamienie milowe, KPI, wpisy kalendarza i posty znajdziesz na pełnej karcie kampanii.
        </p>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold mb-1.5">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
