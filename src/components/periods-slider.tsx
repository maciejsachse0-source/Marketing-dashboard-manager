'use client';

import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
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
}: {
  periods: TemplatePeriod[];
  errors: (string | null)[];
  previewStart: Date;
  onChange: (idx: number, patch: Partial<TemplatePeriod>) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const maxEnd =
    periods.length > 0 ? Math.max(0, ...periods.map((p) => p.endOffsetDays)) : 0;
  const sliderMin = 0;
  const sliderMax = Math.min(
    PERIOD_OFFSET_MAX,
    Math.max(28, Math.ceil((maxEnd + 7) / 7) * 7),
  );
  const sliderDays = sliderMax - sliderMin + 1;

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
    if (d % 7 !== 0) continue;
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
        <span className={`tabular-nums ${tone.ink}`}>
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

      {error ? (
        <p className="text-[11px] text-rose-700 font-medium">{error}</p>
      ) : null}
    </div>
  );
}
