/**
 * Group header row inside the gantt body. Spans the same `22rem | 1fr` grid
 * the day-rows use, so the label sticks to the left rail and the divider on
 * the right column lines up with the timeline grid behind every other row.
 * Used to introduce the NARRACJA block (campaign storytelling layer) and the
 * PRODUKCJE block (per-production pipelines) so the user reads the gantt as
 * two distinct stacks instead of one undifferentiated wall of bars.
 */
export function SectionHeaderRow({
  label,
  hint,
  tone = 'narracja',
}: {
  label: string;
  hint?: string;
  tone?: 'narracja' | 'muted';
}) {
  const labelClasses =
    tone === 'narracja'
      ? 'pill-label pill-label-sm'
      : 'inline-flex items-center px-2.5 py-1 rounded-full border border-border text-[11px] font-bold tracking-[0.18em] text-muted-foreground bg-background';
  return (
    <div
      className="grid border-b border-border/60 bg-muted/30"
      style={{ gridTemplateColumns: `22rem 1fr` }}
    >
      <div className="px-5 py-2 border-r border-border/40 sticky left-0 z-30 bg-muted/40 backdrop-blur shadow-[2px_0_6px_-2px_rgb(0_0_0_/_0.08)] flex items-center gap-2">
        <span className={labelClasses}>{label}</span>
        {hint ? (
          <span className="label-micro text-muted-foreground tabular-nums">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="relative" />
    </div>
  );
}

export function LegendChip({ code, tone, label }: { code: string; tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block w-8 h-4 rounded border ${tone}`} />
      <span className="font-bold text-foreground text-sm">{code}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </span>
  );
}

export function LegendDot({ variant, label }: { variant: 'solid' | 'dashed'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block w-3 h-3 rounded-full bg-card ${
          variant === 'dashed'
            ? 'border-2 border-dashed border-muted-foreground/60'
            : 'border-[3px] border-foreground'
        }`}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}
