import type { CheckpointInfo } from './gantt-milestones';

type MilestoneState = 'passed' | 'active' | 'pending';

// F7-13: kolory i teksty pochodne wyjęte z ciała `map`. Ten sam łańcuch
// `active / passed / reszta` był wpisany trzy razy i sam odpowiadał za jedną
// trzecią złożoności cyklomatycznej pliku.
function stateTextClass(state: MilestoneState): string {
  if (state === 'active') return 'text-foreground';
  return state === 'passed' ? 'text-[var(--accent-blue)]' : 'text-muted-foreground';
}

function weekdayTextClass(state: MilestoneState): string {
  return state === 'pending' ? 'text-muted-foreground/60' : 'text-muted-foreground';
}

/** Godzina pokazywana tylko dla etapów z kalendarzowym slotem i tylko wtedy,
 *  gdy data jest prawdziwa — daty domyślne celowo nie niosą godziny. */
function timeLabel(cp: CheckpointInfo): string | null {
  if (cp.source === 'tentative' || !cp.cat.withTime) return null;
  return cp.date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function sourceHintOf(cp: CheckpointInfo): 'auto' | 'T-0' | null {
  if (cp.source === 'derived') return 'auto';
  return cp.source === 't0' ? 'T-0' : null;
}

/**
 * Podpisy pod kamieniami milowymi: nazwa fazy, dzień tygodnia i data (albo
 * „ustaw datę", gdy daty nie ma). Wydzielone bez zmiany treści z
 * `gantt-milestones.tsx` w F2-02, żeby oba pliki zmieściły się w limicie
 * 300 linii (zasada Z11). Podział na trzy komponenty pochodzi z F7-13 —
 * treść znaczników bez zmian.
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
      {checkpoints.map((cp) => (
        <MilestoneLabel
          key={`label-${cp.cat.key}`}
          cp={cp}
          state={milestoneState(cp.cat)}
          x={tickX(cp)}
          LABEL_TOP={LABEL_TOP}
        />
      ))}
    </>
  );
}

function MilestoneLabel({
  cp,
  state,
  x,
  LABEL_TOP,
}: {
  cp: CheckpointInfo;
  state: MilestoneState;
  x: number;
  LABEL_TOP: string;
}) {
  const tentative = cp.source === 'tentative';
  const sourceHint = tentative ? null : sourceHintOf(cp);
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: LABEL_TOP,
        left: `${x}%`,
        transform: 'translateX(-50%)',
        width: '7rem',
      }}
    >
      <div
        className={`text-[10px] uppercase tracking-[0.1em] font-semibold leading-tight truncate text-center ${stateTextClass(state)}`}
        title={cp.cat.label}
      >
        {cp.cat.label}
      </div>
      {tentative ? (
        <div className="text-[10px] italic text-muted-foreground/60 text-center mt-0.5 leading-tight">
          ustaw datę
        </div>
      ) : (
        <MilestoneDate cp={cp} state={state} />
      )}
      {sourceHint ? (
        <div className="mt-0.5 flex justify-center">
          <span
            className={`text-[8px] uppercase tracking-[0.16em] font-bold px-1 rounded ${
              sourceHint === 'T-0'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            }`}
            title={sourceHint === 'T-0' ? 'Dzień publikacji (T-0)' : 'Auto: dzień po nagrywce'}
          >
            {sourceHint}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function MilestoneDate({ cp, state }: { cp: CheckpointInfo; state: MilestoneState }) {
  const weekday = cp.date.toLocaleDateString('pl-PL', { weekday: 'short' });
  const dayMonth = cp.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  const time = timeLabel(cp);
  return (
    <div className="mt-0.5 flex items-baseline justify-center gap-1 leading-tight">
      <span
        className={`text-[9px] uppercase tracking-[0.16em] font-semibold ${weekdayTextClass(state)}`}
        title={cp.date.toLocaleDateString('pl-PL', { weekday: 'long' })}
      >
        {weekday}
      </span>
      <span className={`text-[11px] tabular-nums font-semibold ${stateTextClass(state)}`}>
        {dayMonth}
      </span>
      {time ? (
        <span className="text-[10px] tabular-nums text-muted-foreground/80">, {time}</span>
      ) : null}
    </div>
  );
}
