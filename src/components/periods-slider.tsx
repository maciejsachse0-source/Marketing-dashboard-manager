'use client';

import { useEffect, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  describeOffset,
  PERIOD_OFFSET_MAX,
  type TemplatePeriod,
} from '@/lib/production-periods';
import {
  dateAt,
  fmtDayMonth,
  MONTH_PL,
  toneForIndex,
  type PeriodTone,
} from '@/lib/period-tones';

/**
 * Reusable T-period slider — shared by template editors and live campaign
 * pages. The component is presentation-only: callers own the periods array
 * and fire updates through `onChange` (no internal state). Pure helpers
 * (tones, date helpers) live in `@/lib/period-tones` so server components
 * can import them without crossing the client boundary.
 */

// Re-export for callers that already imported from this file before the split.
export { toneForIndex, dateAt, fmtDayMonth, isoDate, parseIsoDate } from '@/lib/period-tones';

export function PeriodsSlider({
  periods,
  errors,
  previewStart,
  onChange,
  onRemove,
  canRemove,
  editableNames,
  horizonDays,
}: {
  periods: TemplatePeriod[];
  errors: (string | null)[];
  previewStart: Date;
  onChange: (idx: number, patch: Partial<TemplatePeriod>) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
  /** When true, renders a name input on each period rail so the user can
   *  set "Build-up", "Reveal" etc. straight from the slider UI. Falls back
   *  to read-only display of the existing name when false. Defaults to
   *  false so legacy callers (template-only viewers) stay unchanged. */
  editableNames?: boolean;
  /** Optional fixed visible window — overrides the auto-fit width so the
   *  caller can let the user "zoom out" to grab a broader perspective of the
   *  plan. Always clamped to ≥ what's needed to show every period and ≤
   *  PERIOD_OFFSET_MAX. When omitted, the slider auto-fits to the periods
   *  with a 28-day floor (legacy behavior). */
  horizonDays?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const maxEnd =
    periods.length > 0 ? Math.max(0, ...periods.map((p) => p.endOffsetDays)) : 0;
  const sliderMin = 0;
  const autoFitMax = Math.max(28, Math.ceil((maxEnd + 7) / 7) * 7);
  const requestedMax = horizonDays != null ? Math.max(autoFitMax, horizonDays) : autoFitMax;
  const sliderMax = Math.min(PERIOD_OFFSET_MAX, requestedMax);
  const sliderDays = sliderMax - sliderMin + 1;

  // Adaptive label density — at wider horizons the per-day grid would smear
  // into a noise stripe, so we coarsen tick labels and hide daily numbers
  // entirely past ~8 weeks. Thresholds align with common planning windows
  // (4w, 8w, 12w, 24w, 52w) the horizon picker exposes.
  const tickEveryDays = sliderDays <= 56 ? 7 : sliderDays <= 112 ? 14 : sliderDays <= 196 ? 28 : 56;
  const showDailyNumbers = sliderDays <= 56;

  const dragRef = useRef<{
    periodIdx: number;
    handle: 'start' | 'end' | 'span';
    originStart?: number;
    originEnd?: number;
    originDay?: number;
  } | null>(null);

  const dayFromClientX = (clientX: number): number => {
    const rail = railRef.current;
    if (!rail) return sliderMin;
    const rect = rail.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    const day = Math.round(pct * (sliderDays - 1)) + sliderMin;
    return Math.max(sliderMin, Math.min(sliderMax, day));
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const day = dayFromClientX(e.clientX);
      const cur = periods[drag.periodIdx];
      if (!cur) return;

      if (drag.handle === 'start') {
        const clamped = Math.min(day, cur.endOffsetDays);
        if (clamped !== cur.startOffsetDays) {
          onChange(drag.periodIdx, { startOffsetDays: clamped });
        }
      } else if (drag.handle === 'end') {
        const clamped = Math.max(day, cur.startOffsetDays);
        if (clamped !== cur.endOffsetDays) {
          onChange(drag.periodIdx, { endOffsetDays: clamped });
        }
      } else {
        const delta = day - (drag.originDay ?? day);
        const length =
          (drag.originEnd ?? cur.endOffsetDays) - (drag.originStart ?? cur.startOffsetDays);
        let newStart = (drag.originStart ?? cur.startOffsetDays) + delta;
        if (newStart < sliderMin) newStart = sliderMin;
        if (newStart + length > sliderMax) newStart = sliderMax - length;
        const newEnd = newStart + length;
        if (newStart !== cur.startOffsetDays || newEnd !== cur.endOffsetDays) {
          onChange(drag.periodIdx, {
            startOffsetDays: newStart,
            endOffsetDays: newEnd,
          });
        }
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [periods, onChange, sliderMin, sliderMax, sliderDays]);

  const startDrag = (
    e: React.PointerEvent,
    periodIdx: number,
    handle: 'start' | 'end' | 'span',
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = periods[periodIdx];
    dragRef.current = {
      periodIdx,
      handle,
      originStart: cur.startOffsetDays,
      originEnd: cur.endOffsetDays,
      originDay: dayFromClientX(e.clientX),
    };
    document.body.style.userSelect = 'none';
  };

  const dayToPercent = (d: number) => ((d - sliderMin) / (sliderDays - 1)) * 100;

  const majorTicks: { offset: number; date: Date; label: string }[] = [];
  for (let d = sliderMin; d <= sliderMax; d++) {
    if (d % tickEveryDays !== 0) continue;
    const date = dateAt(previewStart, d);
    majorTicks.push({ offset: d, date, label: fmtDayMonth(date) });
  }

  const monthBoundaries: { offset: number; label: string }[] = [];
  let prevMonth = -1;
  for (let d = sliderMin; d <= sliderMax; d++) {
    const date = dateAt(previewStart, d);
    const m = date.getMonth();
    if (d === sliderMin) {
      prevMonth = m;
      continue;
    }
    if (m !== prevMonth) {
      monthBoundaries.push({ offset: d, label: MONTH_PL[m] });
      prevMonth = m;
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="relative h-4 select-none">
          <span
            className="absolute text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
            style={{ left: `0%` }}
          >
            {MONTH_PL[previewStart.getMonth()]} {previewStart.getFullYear()}
          </span>
          {monthBoundaries.map((m) => (
            <span
              key={m.offset}
              className="absolute -translate-x-1/2 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
              style={{ left: `${dayToPercent(m.offset)}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="relative h-5 select-none">
          {majorTicks.map((t) => (
            <span
              key={t.offset}
              className={`absolute -translate-x-1/2 text-[10px] tracking-tight tabular-nums ${
                t.offset === 0
                  ? 'font-bold text-foreground'
                  : 'text-muted-foreground'
              }`}
              style={{ left: `${dayToPercent(t.offset)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div className="relative h-3 rounded bg-muted/40 select-none">
          {Array.from({ length: sliderDays }).map((_, i) => {
            const d = sliderMin + i;
            const dow = ((d % 7) + 7) % 7;
            const isWeekend = dow >= 5;
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 ${isWeekend ? 'bg-muted-foreground/15' : ''}`}
                style={{
                  left: `${dayToPercent(d) - (0.5 / sliderDays) * 100}%`,
                  width: `${100 / sliderDays}%`,
                }}
              />
            );
          })}
          {monthBoundaries.map((m) => (
            <div
              key={m.offset}
              className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
              style={{ left: `${dayToPercent(m.offset)}%` }}
            />
          ))}
        </div>
        {showDailyNumbers ? (
          <div className="relative h-3 select-none">
            {Array.from({ length: sliderDays }).map((_, i) => {
              const d = sliderMin + i;
              const date = dateAt(previewStart, d);
              const dow = ((d % 7) + 7) % 7;
              const isWeekend = dow >= 5;
              const isFirstOfMonth = date.getDate() === 1;
              return (
                <span
                  key={i}
                  className={`absolute -translate-x-1/2 text-[8px] tabular-nums ${
                    isFirstOfMonth
                      ? 'font-bold text-foreground'
                      : isWeekend
                        ? 'text-muted-foreground/55'
                        : 'text-muted-foreground/80'
                  }`}
                  style={{ left: `${dayToPercent(d)}%` }}
                >
                  {date.getDate()}
                </span>
              );
            })}
          </div>
        ) : null}
        <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums px-0.5">
          <span>{fmtDayMonth(dateAt(previewStart, sliderMin))} (start)</span>
          <span>{fmtDayMonth(dateAt(previewStart, sliderMax))}</span>
        </div>
      </div>

      {periods.map((p, idx) => (
        <PeriodRail
          key={`${p.code}-${idx}`}
          period={p}
          tone={toneForIndex(idx)}
          error={errors[idx]}
          dayToPercent={dayToPercent}
          previewStart={previewStart}
          railRef={idx === 0 ? railRef : undefined}
          onRemove={canRemove ? () => onRemove(idx) : undefined}
          onChangeName={
            editableNames
              ? (name) => onChange(idx, { name: name || undefined })
              : undefined
          }
          onChangeDescription={
            editableNames
              ? (description) =>
                  onChange(idx, { description: description || undefined })
              : undefined
          }
          onPointerDownStart={(e) => startDrag(e, idx, 'start')}
          onPointerDownEnd={(e) => startDrag(e, idx, 'end')}
          onPointerDownSpan={(e) => startDrag(e, idx, 'span')}
          onClickRail={(clientX) => {
            const day = dayFromClientX(clientX);
            const distStart = Math.abs(day - p.startOffsetDays);
            const distEnd = Math.abs(day - p.endOffsetDays);
            if (distStart <= distEnd) {
              onChange(idx, { startOffsetDays: Math.min(day, p.endOffsetDays) });
            } else {
              onChange(idx, { endOffsetDays: Math.max(day, p.startOffsetDays) });
            }
          }}
        />
      ))}
    </div>
  );
}

function PeriodRail({
  period,
  tone,
  error,
  dayToPercent,
  previewStart,
  railRef,
  onRemove,
  onChangeName,
  onChangeDescription,
  onPointerDownStart,
  onPointerDownEnd,
  onPointerDownSpan,
  onClickRail,
}: {
  period: TemplatePeriod;
  tone: { bg: string; bar: string; thumb: string; ink: string };
  error: string | null;
  dayToPercent: (d: number) => number;
  previewStart: Date;
  railRef?: React.Ref<HTMLDivElement>;
  onRemove?: () => void;
  /** When provided, renders a small inline name input above the rail. The
   *  parent owns the name (it's part of the period state) and persists
   *  through `onChange({ name })` from the slider's overall API. */
  onChangeName?: (name: string) => void;
  /** When provided, renders an inline textarea for the period description
   *  below the rail. Same lift-state-up pattern as `onChangeName`. */
  onChangeDescription?: (description: string) => void;
  onPointerDownStart: (e: React.PointerEvent) => void;
  onPointerDownEnd: (e: React.PointerEvent) => void;
  onPointerDownSpan: (e: React.PointerEvent) => void;
  onClickRail: (clientX: number) => void;
}) {
  const startPct = dayToPercent(period.startOffsetDays);
  const endPct = dayToPercent(period.endOffsetDays);
  const widthPct = endPct - startPct;
  const lengthDays = period.endOffsetDays - period.startOffsetDays + 1;
  const startDate = dateAt(previewStart, period.startOffsetDays);
  const endDate = dateAt(previewStart, period.endOffsetDays);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={`inline-flex items-center justify-center min-w-[2rem] h-5 px-1.5 rounded text-[10px] font-bold tracking-[0.18em] tabular-nums ${tone.bar} ${tone.ink}`}
        >
          {period.code}
        </span>
        {onChangeName ? (
          <label
            className={`group/name inline-flex items-center gap-1 rounded border border-dashed ${tone.thumb.split(' ').find((c) => c.startsWith('border-')) ?? 'border-current/40'} bg-background/60 px-1.5 py-0.5 hover:bg-background/90 focus-within:bg-background focus-within:border-solid ui-transition`}
            title="Klik, by zmienić nazwę okresu"
          >
            <Pencil className={`w-3 h-3 ${tone.ink} opacity-60 group-hover/name:opacity-100 group-focus-within/name:opacity-100 shrink-0`} />
            <input
              type="text"
              value={period.name ?? ''}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder={`Nazwa fazy ${period.code} (np. Build-up)`}
              maxLength={40}
              aria-label={`Nazwa okresu ${period.code}`}
              className={`text-xs font-bold tracking-tight ${tone.ink} bg-transparent focus:outline-none placeholder:font-normal placeholder:opacity-60 min-w-[9rem]`}
            />
          </label>
        ) : period.name ? (
          <span className={`text-xs font-bold tracking-tight ${tone.ink}`}>
            {period.name}
          </span>
        ) : null}
        <span className={`tabular-nums ${tone.ink} text-[10px] opacity-80`}>
          {fmtDayMonth(startDate)} → {fmtDayMonth(endDate)}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          ({describeOffset(period.startOffsetDays)} → {describeOffset(period.endOffsetDays)})
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {lengthDays} {lengthDays === 1 ? 'dzień' : 'dni'}
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
            title={`Usuń ${period.code}`}
            aria-label={`Usuń ${period.code}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      <div
        ref={railRef}
        className={`relative h-9 rounded-md ${tone.bg} ${error ? 'ring-2 ring-rose-400' : ''} touch-none cursor-pointer`}
        onPointerDown={(e) => {
          onClickRail(e.clientX);
        }}
      >
        <div
          className={`absolute top-1 bottom-1 rounded ${tone.bar} cursor-grab active:cursor-grabbing`}
          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
          onPointerDown={onPointerDownSpan}
          title="Przeciągnij, by przesunąć cały okres"
        />
        <button
          type="button"
          onPointerDown={onPointerDownStart}
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-7 rounded border-2 ${tone.thumb} cursor-ew-resize shadow-md hover:scale-110 ui-transition`}
          style={{ left: `${startPct}%` }}
          aria-label={`${period.code} początek`}
          title={`Start: ${fmtDayMonth(startDate)} · ${describeOffset(period.startOffsetDays)}`}
        />
        <button
          type="button"
          onPointerDown={onPointerDownEnd}
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-7 rounded border-2 ${tone.thumb} cursor-ew-resize shadow-md hover:scale-110 ui-transition`}
          style={{ left: `${endPct}%` }}
          aria-label={`${period.code} koniec`}
          title={`Koniec: ${fmtDayMonth(endDate)} · ${describeOffset(period.endOffsetDays)}`}
        />
      </div>

      {onChangeDescription ? (
        <label
          className={`group/desc block rounded border border-dashed ${tone.thumb.split(' ').find((c) => c.startsWith('border-')) ?? 'border-current/40'} bg-background/40 hover:bg-background/80 focus-within:bg-background focus-within:border-solid ui-transition`}
          title="Klik, by zmienić opis okresu"
        >
          <div className={`flex items-start gap-1.5 px-2 py-1.5`}>
            <Pencil
              className={`w-3 h-3 mt-0.5 ${tone.ink} opacity-50 group-hover/desc:opacity-100 group-focus-within/desc:opacity-100 shrink-0`}
            />
            <textarea
              value={period.description ?? ''}
              onChange={(e) => onChangeDescription(e.target.value)}
              placeholder={`Opis okresu ${period.code} — co chcesz, żeby widz POCZUŁ w tej fazie`}
              maxLength={500}
              rows={2}
              aria-label={`Opis okresu ${period.code}`}
              className={`flex-1 text-[11px] leading-snug ${tone.ink} bg-transparent focus:outline-none resize-none placeholder:opacity-60 placeholder:italic`}
            />
          </div>
        </label>
      ) : period.description ? (
        <p className={`text-[11px] leading-snug ${tone.ink} opacity-90 italic px-1`}>
          {period.description}
        </p>
      ) : null}

      {error ? (
        <p className="text-[11px] text-rose-700 font-medium">{error}</p>
      ) : null}
    </div>
  );
}
