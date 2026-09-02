import type { CheckpointInfo } from './gantt-milestones';

/**
 * Podpisy pod kamieniami milowymi: nazwa fazy, dzień tygodnia i data (albo
 * „ustaw datę", gdy daty nie ma). Wydzielone bez zmiany treści z
 * `gantt-milestones.tsx` w F2-02, żeby oba pliki zmieściły się w limicie
 * 300 linii (zasada Z11).
 */
export function MilestoneLabels({
  checkpoints,
  milestoneState,
  tickX,
  LABEL_TOP,
}: {
  checkpoints: CheckpointInfo[];
  milestoneState: (cat: CheckpointInfo['cat']) => 'passed' | 'active' | 'pending';
  tickX: (cp: CheckpointInfo) => number;
  LABEL_TOP: string;
}) {
  return (
    <>
      {/* Labels under each tick — name + weekday + date (or "ustaw datę" if
          tentative). Centered on tick x. Width caps prevent runaway in narrow
          zooms. Date is split into weekday badge + day.month so the calendar
          context is scannable at a glance ("śr 14.05" beats "14.05" alone).
          Time is appended only for stages whose checkpoint is a calendar slot
          (nagrywanie/obrobka) AND a real date was recorded — tentative dates
          deliberately skip the time noise. */}
      {checkpoints.map((cp) => {
        const state = milestoneState(cp.cat);
        const tentative = cp.source === 'tentative';
        const x = tickX(cp);
        const weekday = cp.date.toLocaleDateString('pl-PL', { weekday: 'short' });
        const dayMonth = cp.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
        const showTime = !tentative && cp.cat.withTime && cp.source !== 'tentative';
        const time = showTime
          ? cp.date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
          : null;
        const sourceHint =
          cp.source === 'derived' ? 'auto' : cp.source === 't0' ? 'T-0' : null;
        return (
          <div
            key={`label-${cp.cat.key}`}
            className="absolute pointer-events-none"
            style={{
              top: LABEL_TOP,
              left: `${x}%`,
              transform: 'translateX(-50%)',
              width: '7rem',
            }}
          >
            <div
              className={`text-[10px] uppercase tracking-[0.1em] font-semibold leading-tight truncate text-center ${
                state === 'active'
                  ? 'text-foreground'
                  : state === 'passed'
                    ? 'text-[var(--accent-blue)]'
                    : 'text-muted-foreground'
              }`}
              title={cp.cat.label}
            >
              {cp.cat.label}
            </div>
            {tentative ? (
              <div className="text-[10px] italic text-muted-foreground/60 text-center mt-0.5 leading-tight">
                ustaw datę
              </div>
            ) : (
              <div className="mt-0.5 flex items-baseline justify-center gap-1 leading-tight">
                <span
                  className={`text-[9px] uppercase tracking-[0.16em] font-semibold ${
                    state === 'active' || state === 'passed'
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                  }`}
                  title={cp.date.toLocaleDateString('pl-PL', { weekday: 'long' })}
                >
                  {weekday}
                </span>
                <span
                  className={`text-[11px] tabular-nums font-semibold ${
                    state === 'active'
                      ? 'text-foreground'
                      : state === 'passed'
                        ? 'text-[var(--accent-blue)]'
                        : 'text-muted-foreground'
                  }`}
                >
                  {dayMonth}
                </span>
                {time ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground/80">
                    , {time}
                  </span>
                ) : null}
              </div>
            )}
            {sourceHint && !tentative ? (
              <div className="mt-0.5 flex justify-center">
                <span
                  className={`text-[8px] uppercase tracking-[0.16em] font-bold px-1 rounded ${
                    sourceHint === 'T-0'
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title={
                    sourceHint === 'T-0'
                      ? 'Dzień publikacji (T-0)'
                      : 'Auto: dzień po nagrywce'
                  }
                >
                  {sourceHint}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
