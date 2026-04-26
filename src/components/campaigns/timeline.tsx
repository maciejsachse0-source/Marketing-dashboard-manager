import type { CalendarEntry } from '../../../drizzle/schema';
import { TYPE_COLOR, TYPE_LABEL } from '../calendar/type-color';

const RANGE_BEFORE_DAYS = 30;
const RANGE_AFTER_DAYS = 30;
const TOTAL = RANGE_BEFORE_DAYS + RANGE_AFTER_DAYS;

export function CampaignTimeline({
  releaseAt,
  entries,
}: {
  releaseAt: Date;
  entries: CalendarEntry[];
}) {
  const t0 = releaseAt.getTime();
  const day = 24 * 60 * 60 * 1000;

  const inRange = entries
    .map((e) => {
      const offsetDays = (e.startsAt.getTime() - t0) / day;
      const pct = ((offsetDays + RANGE_BEFORE_DAYS) / TOTAL) * 100;
      return { ...e, offsetDays, pct };
    })
    .filter((e) => e.offsetDays >= -RANGE_BEFORE_DAYS && e.offsetDays <= RANGE_AFTER_DAYS);

  const phases: { label: string; from: number; to: number; color: string }[] = [
    { label: 'Build-up', from: -30, to: -15, color: 'bg-zinc-500/10' },
    { label: 'Teaser', from: -14, to: -7, color: 'bg-violet-500/10' },
    { label: 'Reveal', from: -7, to: 0, color: 'bg-amber-500/10' },
    { label: 'Release', from: 0, to: 7, color: 'bg-emerald-500/10' },
    { label: 'Afterglow', from: 7, to: 30, color: 'bg-sky-500/10' },
  ];

  const dayPct = (d: number) => ((d + RANGE_BEFORE_DAYS) / TOTAL) * 100;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        Timeline · T-{RANGE_BEFORE_DAYS} → T+{RANGE_AFTER_DAYS}
      </div>

      <div className="relative h-32 border-t border-b border-border">
        {phases.map((p) => {
          const left = dayPct(p.from);
          const width = dayPct(p.to) - left;
          return (
            <div
              key={p.label}
              className={`absolute top-0 bottom-0 ${p.color} border-r border-border/50`}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="absolute top-1 left-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {p.label}
              </span>
            </div>
          );
        })}

        <div
          className="absolute top-0 bottom-0 w-px bg-foreground"
          style={{ left: `${dayPct(0)}%` }}
        >
          <span className="absolute -top-1 -translate-x-1/2 text-[10px] font-medium px-1 bg-background">
            T-0
          </span>
        </div>

        {inRange.map((e, idx) => (
          <div
            key={e.id}
            className="absolute group"
            style={{
              left: `${e.pct}%`,
              top: `${20 + (idx % 4) * 20}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full border ${TYPE_COLOR[e.type]} cursor-help`}
              title={`${e.title} · ${e.startsAt.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })} · ${TYPE_LABEL[e.type]}`}
            />
            <div className="absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[10px] bg-background border border-border rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none z-10 max-w-48 truncate">
              T{e.offsetDays >= 0 ? '+' : ''}{Math.round(e.offsetDays)} · {e.title}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground tabular-nums">
        <span>T-30</span>
        <span>T-15</span>
        <span>T-7</span>
        <span className="font-medium text-foreground">T-0</span>
        <span>T+7</span>
        <span>T+15</span>
        <span>T+30</span>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        Legenda:
        {Object.entries(TYPE_LABEL).map(([t, label]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full border ${TYPE_COLOR[t as keyof typeof TYPE_COLOR]}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {inRange.length} z {entries.length} wpisów w zakresie T-{RANGE_BEFORE_DAYS}…T+{RANGE_AFTER_DAYS}
      </div>
    </div>
  );
}
