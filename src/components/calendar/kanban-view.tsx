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
    tint: string;
    chip: string;
    badge: string;
  }
> = {
  outreach: {
    code: 'T1',
    label: 'Outreach + ustalenia',
    icon: Send,
    tint: 'bg-amber-50/70 border-amber-200',
    chip: 'bg-amber-100 text-amber-900',
    badge: 'bg-amber-900 text-amber-50',
  },
  'shoot-edit': {
    code: 'T2',
    label: 'Nagrywka + obróbka',
    icon: Camera,
    tint: 'bg-violet-50/70 border-violet-200',
    chip: 'bg-violet-100 text-violet-900',
    badge: 'bg-violet-900 text-violet-50',
  },
  publish: {
    code: 'T3',
    label: 'Publikacja',
    icon: Megaphone,
    tint: 'bg-emerald-50/70 border-emerald-200',
    chip: 'bg-emerald-100 text-emerald-900',
    badge: 'bg-emerald-900 text-emerald-50',
  },
};

const MAX_VISIBLE_ARTISTS = 4;

/** Monday of the week containing `d`, normalized to 00:00 local time. */
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const dow = (m.getDay() + 6) % 7; // 0 = Monday
  m.setDate(m.getDate() - dow);
  return m;
}

type ArtistRow = {
  productionId: number;
  title: string;
  slug: string;
  artistName: string | null;
  artistHandle: string | null;
  /** Index of the publication week within `weeks`. May be > weeks.length-1 (off-screen). */
  publishWeekIdx: number;
};

export function KanbanView({
  weeks,
  productions,
}: {
  /** Mondays of the visible weeks (length === KANBAN_WEEKS). */
  weeks: Date[];
  productions: Record<number, ProductionMeta>;
}) {
  const firstWeekStart = weeks[0];
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const rows: ArtistRow[] = [];
  for (const p of Object.values(productions)) {
    const t0Monday = mondayOf(p.t0At);
    const publishWeekIdx = Math.round(
      (t0Monday.getTime() - firstWeekStart.getTime()) / weekMs,
    );

    // Phase span is [publishWeekIdx - 2, publishWeekIdx]. Keep the row only if
    // any phase falls within the visible window [0, weeks.length - 1].
    const minPhase = publishWeekIdx - 2;
    const maxPhase = publishWeekIdx;
    if (maxPhase < 0 || minPhase > weeks.length - 1) continue;

    rows.push({
      productionId: p.id,
      title: p.title,
      slug: p.slug,
      artistName: p.artistName,
      artistHandle: p.artistHandle,
      publishWeekIdx,
    });
  }

  // Production order: earliest t0 first. Ties broken by id for stability.
  rows.sort(
    (a, b) =>
      a.publishWeekIdx - b.publishWeekIdx || a.productionId - b.productionId,
  );

  const visibleRows = rows.slice(0, MAX_VISIBLE_ARTISTS);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-3 min-w-[1100px]"
        style={{
          gridTemplateColumns: `13rem repeat(${weeks.length}, minmax(11rem, 1fr))`,
        }}
      >
        {/* Top-left empty cell */}
        <div />
        {/* Week headers */}
        {weeks.map((w, i) => {
          const wEnd = new Date(w);
          wEnd.setDate(wEnd.getDate() + 6);
          const isCurrent = i === 0;
          return (
            <div key={i} className="px-3 py-2">
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

        {/* Artist rows */}
        {visibleRows.length === 0 ? (
          <div
            className="col-span-full px-3 py-12 text-center text-sm text-muted-foreground"
            style={{ gridColumn: `1 / span ${weeks.length + 1}` }}
          >
            Brak artystów w pipeline w tym oknie.
          </div>
        ) : null}

        {visibleRows.map((row) => {
          const displayName = row.artistName ?? row.title;
          return [
            <Link
              key={`${row.productionId}-label`}
              href={`/productions/${row.productionId}`}
              className="px-3 py-3 flex items-start gap-2.5 rounded-xl hover:bg-muted/50 transition group"
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
            </Link>,
            ...weeks.map((_w, wIdx) => {
              let phase: Phase | null = null;
              if (wIdx === row.publishWeekIdx) phase = 'publish';
              else if (wIdx === row.publishWeekIdx - 1) phase = 'shoot-edit';
              else if (wIdx === row.publishWeekIdx - 2) phase = 'outreach';

              if (!phase) {
                return (
                  <div
                    key={`${row.productionId}-${wIdx}`}
                    className="min-h-[6.5rem] rounded-2xl border border-dashed border-muted-foreground/15"
                  />
                );
              }

              const meta = PHASE_META[phase];
              const Icon = meta.icon;
              return (
                <div
                  key={`${row.productionId}-${wIdx}`}
                  className={`min-h-[6.5rem] rounded-2xl border p-2 ${meta.tint}`}
                >
                  <Link
                    href={`/productions/${row.productionId}`}
                    className="block bg-card rounded-xl border border-border px-3 py-2.5 hover:border-foreground/40 hover:shadow-sm transition group h-full"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-md text-[10px] font-bold tracking-[0.1em] tabular-nums ${meta.badge}`}
                      >
                        {meta.code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${meta.chip}`}
                      >
                        <Icon className="w-3 h-3" strokeWidth={2.25} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium truncate group-hover:text-foreground transition">
                      {displayName}
                    </div>
                    {row.artistHandle ? (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {row.artistHandle}
                      </div>
                    ) : null}
                  </Link>
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}
