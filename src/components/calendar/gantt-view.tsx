import Link from 'next/link';
import { Camera, Send, Megaphone } from 'lucide-react';
import { PersonAvatar, SoloAvatar } from '@/components/productions/artist-avatar';
import type { ProductionMeta } from '@/components/calendar/production-meta';

type Phase = 'outreach' | 'shoot-edit' | 'publish';

const PHASE_META: Record<
  Phase,
  {
    code: 'T1' | 'T2' | 'T3';
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    bar: string;
    chip: string;
  }
> = {
  outreach: {
    code: 'T1',
    label: 'Outreach',
    icon: Send,
    bar: 'bg-amber-200/80 border-amber-300 text-amber-950',
    chip: 'bg-amber-900 text-amber-50',
  },
  'shoot-edit': {
    code: 'T2',
    label: 'Nagrywka + obróbka',
    icon: Camera,
    bar: 'bg-violet-200/80 border-violet-300 text-violet-950',
    chip: 'bg-violet-900 text-violet-50',
  },
  publish: {
    code: 'T3',
    label: 'Publikacja',
    icon: Megaphone,
    bar: 'bg-emerald-200/80 border-emerald-300 text-emerald-950',
    chip: 'bg-emerald-900 text-emerald-50',
  },
};

const PHASE_ORDER: Phase[] = ['outreach', 'shoot-edit', 'publish'];
const MAX_VISIBLE_ARTISTS = 8;

/** Monday of the week containing `d`, normalized to 00:00 local time. */
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const dow = (m.getDay() + 6) % 7; // 0 = Monday
  m.setDate(m.getDate() - dow);
  return m;
}

type GanttRow = {
  productionId: number;
  title: string;
  slug: string;
  artistName: string | null;
  artistHandle: string | null;
  /** Index of the publish week within `weeks`. May be negative or > weeks.length-1. */
  publishWeekIdx: number;
};

export function GanttView({
  weeks,
  productions,
}: {
  /** Mondays of the visible weeks. */
  weeks: Date[];
  productions: Record<number, ProductionMeta>;
}) {
  const firstWeekStart = weeks[0];
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = weeks.length;

  const rows: GanttRow[] = [];
  for (const p of Object.values(productions)) {
    const t0Monday = mondayOf(p.t0At);
    const publishWeekIdx = Math.round(
      (t0Monday.getTime() - firstWeekStart.getTime()) / weekMs,
    );

    // Phase span is [publishWeekIdx - 2, publishWeekIdx]. Keep the row only if
    // any phase falls within the visible window [0, weeks.length - 1].
    const minPhase = publishWeekIdx - 2;
    const maxPhase = publishWeekIdx;
    if (maxPhase < 0 || minPhase > totalWeeks - 1) continue;

    rows.push({
      productionId: p.id,
      title: p.title,
      slug: p.slug,
      artistName: p.artistName,
      artistHandle: p.artistHandle,
      publishWeekIdx,
    });
  }

  rows.sort(
    (a, b) =>
      a.publishWeekIdx - b.publishWeekIdx || a.productionId - b.productionId,
  );

  const visibleRows = rows.slice(0, MAX_VISIBLE_ARTISTS);
  const colWidth = 100 / totalWeeks;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1100px]">
        {/* Header */}
        <div
          className="grid gap-0"
          style={{ gridTemplateColumns: `13rem 1fr` }}
        >
          <div />
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
          >
            {weeks.map((w, i) => {
              const wEnd = new Date(w);
              wEnd.setDate(wEnd.getDate() + 6);
              const isCurrent = i === 0;
              return (
                <div
                  key={i}
                  className={`px-3 py-2 border-l border-border/60 ${
                    i === totalWeeks - 1 ? 'border-r' : ''
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${
                      isCurrent ? 'text-foreground' : 'text-muted-foreground/70'
                    }`}
                  >
                    Tydzień {i + 1}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    {w.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                    {' – '}
                    {wEnd.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {visibleRows.length === 0 ? (
          <div className="px-3 py-12 text-center text-sm text-muted-foreground">
            Brak artystów w pipeline w tym oknie.
          </div>
        ) : null}

        <div className="flex flex-col">
          {visibleRows.map((row) => {
            const displayName = row.artistName ?? row.title;
            return (
              <div
                key={row.productionId}
                className="grid gap-0 border-t border-border/40 hover:bg-muted/30 transition group"
                style={{ gridTemplateColumns: `13rem 1fr` }}
              >
                {/* Label cell */}
                <Link
                  href={`/productions/${row.productionId}`}
                  className="px-3 py-3 flex items-start gap-2.5 transition"
                >
                  {row.artistName ? (
                    <PersonAvatar
                      name={row.artistName}
                      seed={row.artistHandle ?? row.artistName}
                      size="md"
                      kind="artist"
                    />
                  ) : (
                    <SoloAvatar size="md" />
                  )}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-sm font-semibold truncate group-hover:text-foreground transition">
                      {displayName}
                    </div>
                    {row.artistHandle ? (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {row.artistHandle}
                      </div>
                    ) : null}
                  </div>
                </Link>

                {/* Timeline cell with bars */}
                <div
                  className="relative h-[4.5rem] border-l border-border/60"
                  style={{
                    backgroundImage: `linear-gradient(to right, var(--border) 1px, transparent 1px)`,
                    backgroundSize: `${colWidth}% 100%`,
                  }}
                >
                  {PHASE_ORDER.map((phase, phaseIdx) => {
                    const offsetWeeks = phaseIdx - 2; // -2, -1, 0
                    const weekIdx = row.publishWeekIdx + offsetWeeks;
                    if (weekIdx < 0 || weekIdx > totalWeeks - 1) return null;

                    const meta = PHASE_META[phase];
                    const Icon = meta.icon;
                    const left = weekIdx * colWidth;
                    return (
                      <Link
                        key={phase}
                        href={`/productions/${row.productionId}`}
                        className={`absolute top-2 bottom-2 rounded-lg border ${meta.bar} hover:shadow-md hover:brightness-105 transition flex items-center gap-1.5 px-2.5 overflow-hidden`}
                        style={{
                          left: `calc(${left}% + 4px)`,
                          width: `calc(${colWidth}% - 8px)`,
                        }}
                        title={`${meta.code} · ${meta.label} · ${displayName}`}
                      >
                        <span
                          className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-md text-[10px] font-bold tracking-[0.1em] tabular-nums shrink-0 ${meta.chip}`}
                        >
                          {meta.code}
                        </span>
                        <Icon className="w-3 h-3 shrink-0" strokeWidth={2.25} />
                        <span className="text-xs font-medium truncate">
                          {meta.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
