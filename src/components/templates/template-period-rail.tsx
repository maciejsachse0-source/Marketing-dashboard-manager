'use client';

/** Jedna szyna okresu: pigułka z kodem i zakresem dat, przeciągalny pas oraz dwa
 *  uchwyty. Wydzielona z `template-form.tsx` przy rozbiciu pliku (F3-07), treść
 *  bez zmian. */
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeOffset, type TemplatePeriod } from '@/lib/production-periods';
import { dateAt, fmtDayMonth } from './template-form-utils';

export function PeriodRail({
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
  /** Anchor for converting offsets to concrete dates in chip + tooltips. */
  previewStart: Date;
  /** Only the FIRST rail registers the shared ref — that's what the drag math
   *  reads to convert clientX → day. All rails are the same width inside the
   *  same flex container so one ref suffices. */
  railRef?: React.Ref<HTMLDivElement>;
  /** Trash button rendered next to the period chip when count > MIN_PERIODS. */
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
          <Button
            variant="ghost"
            onClick={onRemove}
            className="h-auto border-0 font-normal bg-clip-border p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
            title={`Usuń ${period.code}`}
            aria-label={`Usuń ${period.code}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div
        ref={railRef}
        className={`relative h-9 rounded-md ${tone.bg} ${error ? 'ring-2 ring-rose-400' : ''} touch-none cursor-pointer`}
        onPointerDown={(e) => {
          // Click directly on the rail (not on a thumb / span) — move nearest
          // endpoint there. Pointer events bubble up; thumbs stop propagation.
          onClickRail(e.clientX);
        }}
      >
        {/* Filled span — drag to translate */}
        <div
          className={`absolute top-1 bottom-1 rounded ${tone.bar} cursor-grab active:cursor-grabbing`}
          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
          onPointerDown={onPointerDownSpan}
          title="Przeciągnij, by przesunąć cały okres"
        />
        {/* Start thumb */}
        <Button
          variant="ghost"
          onPointerDown={onPointerDownStart}
          className={`p-0 font-normal hover:bg-transparent hover:text-inherit absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-7 rounded border-2 ${tone.thumb} cursor-ew-resize shadow-md hover:scale-110 ui-transition`}
          style={{ left: `${startPct}%` }}
          aria-label={`${period.code} początek`}
          title={`Start: ${fmtDayMonth(startDate)}, ${describeOffset(period.startOffsetDays)}`}
        />
        {/* End thumb */}
        <Button
          variant="ghost"
          onPointerDown={onPointerDownEnd}
          className={`p-0 font-normal hover:bg-transparent hover:text-inherit absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-7 rounded border-2 ${tone.thumb} cursor-ew-resize shadow-md hover:scale-110 ui-transition`}
          style={{ left: `${endPct}%` }}
          aria-label={`${period.code} koniec`}
          title={`Koniec: ${fmtDayMonth(endDate)}, ${describeOffset(period.endOffsetDays)}`}
        />
      </div>

      {error ? (
        <p className="text-[11px] text-rose-700 font-medium">{error}</p>
      ) : null}
    </div>
  );
}
