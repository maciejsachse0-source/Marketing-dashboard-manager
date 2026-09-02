'use client';

/**
 * Slider editor for a variable number of periods on a shared horizontal axis.
 * Each period is a colored bar with start/end thumbs (drag) plus a body that
 * translates the whole period when dragged. Same axis = the user can VISUALLY
 * check non-overlap and ordering without reading numbers.
 *
 * Axis: 0..sliderMax days from the production's start day. sliderMax adapts
 * to the longest period so the strip always shows real estate beyond the
 * last period (room to extend or add another). Snapping is per-day. Day-of-
 * week initials sit under the cells so individual dates stay legible.
 *
 * Wydzielony z `template-form.tsx` przy rozbiciu pliku (F3-07): oś czasu poszła
 * do `PeriodAxis`, pojedyncza szyna do `PeriodRail`, logika przeciągania została.
 */
import { useEffect, useRef } from 'react';
import { PERIOD_OFFSET_MAX, type TemplatePeriod } from '@/lib/production-periods';
import { PERIOD_TONES } from './template-form-utils';
import { PeriodAxis } from './template-period-axis';
import { PeriodRail } from './template-period-rail';

type Drag = {
  periodIdx: number;
  handle: 'start' | 'end' | 'span';
  /** For 'span' drags: the original period and the day where the drag began,
   *  so we translate by delta instead of pinning the period start to the
   *  cursor (which would feel jumpy if the user grabs the middle). */
  originStart: number;
  originEnd: number;
  originDay: number;
};

/** Poprawka okresu dla trwającego przeciągania, albo `null`, gdy nic się nie zmienia.
 *  Wydzielona z uchwytu `pointermove`, żeby zmieścić go w progu złożoności 10 (Z11).
 *  Zachowanie bez zmian: uchwyty przycinają się do siebie, a przeciąganie całego
 *  okresu przesuwa go o deltę kursora i zatrzymuje na krańcach osi. */
function patchForDrag(
  drag: Drag,
  cur: TemplatePeriod,
  day: number,
  sliderMin: number,
  sliderMax: number,
): Partial<TemplatePeriod> | null {
  if (drag.handle === 'start') {
    // Allow start to cross beyond end momentarily — the live error UI flags
    // it; user resolves by dragging end. Hard-clamp keeps it ≤ end so the
    // bar doesn't visually invert.
    const clamped = Math.min(day, cur.endOffsetDays);
    return clamped === cur.startOffsetDays ? null : { startOffsetDays: clamped };
  }
  if (drag.handle === 'end') {
    const clamped = Math.max(day, cur.startOffsetDays);
    return clamped === cur.endOffsetDays ? null : { endOffsetDays: clamped };
  }
  // Span drag = translate the whole period by the cursor delta.
  const length = drag.originEnd - drag.originStart;
  let newStart = drag.originStart + (day - drag.originDay);
  // Clamp so the period stays inside the visible axis.
  if (newStart < sliderMin) newStart = sliderMin;
  if (newStart + length > sliderMax) newStart = sliderMax - length;
  const newEnd = newStart + length;
  if (newStart === cur.startOffsetDays && newEnd === cur.endOffsetDays) return null;
  return { startOffsetDays: newStart, endOffsetDays: newEnd };
}

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
  /** Anchors the axis to a real calendar — labels become concrete dates
   *  ("12 maj") and day-of-month numbers, plus month boundary markers. */
  previewStart: Date;
  onChange: (idx: number, patch: Partial<TemplatePeriod>) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  // Axis max scales with the longest period so the strip always has room
  // beyond the last period for editing/extending. Floor at 28 so a fresh
  // template doesn't render a tiny axis.
  const maxEnd = periods.length > 0
    ? Math.max(0, ...periods.map((p) => p.endOffsetDays))
    : 0;
  const sliderMin = 0;
  const sliderMax = Math.min(
    PERIOD_OFFSET_MAX,
    Math.max(28, Math.ceil((maxEnd + 7) / 7) * 7),
  );
  const sliderDays = sliderMax - sliderMin + 1;

  // While dragging we keep a ref instead of state so the global pointermove
  // listener doesn't re-bind on every update — react re-renders are still
  // driven through `onChange`.
  const dragRef = useRef<Drag | null>(null);

  const dayFromClientX = (clientX: number): number => {
    const rail = railRef.current;
    if (!rail) return sliderMin;
    const rect = rail.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    const day = Math.round(pct * (sliderDays - 1)) + sliderMin;
    return Math.max(sliderMin, Math.min(sliderMax, day));
  };

  // Global pointer listeners installed once — we read the active drag from
  // dragRef so the closure stays stable for the listener's lifetime.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const cur = periods[drag.periodIdx];
      if (!cur) return;
      const patch = patchForDrag(drag, cur, dayFromClientX(e.clientX), sliderMin, sliderMax);
      if (patch) onChange(drag.periodIdx, patch);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.classList.remove('select-none');
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
    document.body.classList.add('select-none');
  };

  const dayToPercent = (d: number) =>
    ((d - sliderMin) / (sliderDays - 1)) * 100;

  return (
    <div className="space-y-4">
      <PeriodAxis
        sliderMin={sliderMin}
        sliderMax={sliderMax}
        sliderDays={sliderDays}
        previewStart={previewStart}
        dayToPercent={dayToPercent}
      />


      {/* One rail per period — same axis, draggable colored span + 2 thumbs */}
      {periods.map((p, idx) => (
        <PeriodRail
          key={`${p.code}-${idx}`}
          period={p}
          tone={PERIOD_TONES[idx % PERIOD_TONES.length]}
          error={errors[idx]}
          dayToPercent={dayToPercent}
          previewStart={previewStart}
          railRef={idx === 0 ? railRef : undefined}
          onRemove={canRemove ? () => onRemove(idx) : undefined}
          onPointerDownStart={(e) => startDrag(e, idx, 'start')}
          onPointerDownEnd={(e) => startDrag(e, idx, 'end')}
          onPointerDownSpan={(e) => startDrag(e, idx, 'span')}
          onClickRail={(clientX) => {
            // Click on empty rail = move nearest endpoint to clicked day.
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
