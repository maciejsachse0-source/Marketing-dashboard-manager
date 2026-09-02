'use client';

import { FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { openProductionFolder } from '@/server/actions/production-folder';
import { FRAME_TONE } from './gantt-frames';
import type { GanttRow } from './gantt-geometry';
import type { RowModel } from './gantt-row-model';
import { Button } from '@/components/ui/button';

/**
 * Górny pas wiersza: tło siatki kalendarza, pasy T1/T2/T3, skróty do folderów
 * roboczych i pinezki kroków z zapisaną datą. Przeniesiony bez zmiany treści
 * z `gantt-view.tsx` w F2-02.
 */
export function GanttRowBands({
  row,
  displayName,
  days,
  dayWidthPct,
  frameBands,
  stagePins,
}: {
  row: GanttRow;
  displayName: string;
  days: { isWeekend: boolean }[];
  dayWidthPct: number;
  frameBands: RowModel['frameBands'];
  stagePins: RowModel['stagePins'];
}) {
  return (
        <div
          className="absolute top-0 left-0 right-0 h-[5.5rem]"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${dayWidthPct}% - 1px), var(--border) calc(${dayWidthPct}% - 1px), var(--border) ${dayWidthPct}%)`,
          }}
        >
          {days.map((d, i) =>
            d.isWeekend ? (
              <div
                key={`we-${i}`}
                className="absolute top-0 bottom-0 bg-muted/30 pointer-events-none"
                style={{ left: `${i * dayWidthPct}%`, width: `${dayWidthPct}%` }}
              />
            ) : null,
          )}

          {frameBands.map((band) => {
            const tone = FRAME_TONE[band.code];
            const left = band.startDay * dayWidthPct;
            const width = (band.endDay - band.startDay + 1) * dayWidthPct;
            return (
              <div
                key={band.code}
                className={`absolute top-0 bottom-0 ${tone.bg} pointer-events-none border ${tone.border} rounded-md`}
                style={{ left: `${left}%`, width: `${width}%` }}
                aria-hidden
              >
                <span
                  className={`absolute top-2 left-3 text-[11px] uppercase tracking-[0.2em] font-bold ${tone.ink} opacity-90`}
                >
                  {band.code}
                </span>
              </div>
            );
          })}

          {/* Folder shortcuts — quick-open the production work-folder stage in
              the OS file manager. T2 hosts nagrywanie + obrobka (raw footage
              + edit projects); T3 hosts publikacja (per-platform finals).
              T1 is communication-only — no working folder. Rendered as
              siblings of the band rectangles so the band can stay
              pointer-events-none while the buttons remain clickable. */}
          {frameBands.map((band) => {
            const stages: { stage: 'nagrywanie' | 'obrobka' | 'publikacja'; label: string }[] =
              band.code === 'T2'
                ? [
                    { stage: 'nagrywanie', label: 'nagrywanie' },
                    { stage: 'obrobka', label: 'obróbka' },
                  ]
                : band.code === 'T3'
                  ? [{ stage: 'publikacja', label: 'publikacja' }]
                  : [];
            if (stages.length === 0) return null;
            const tone = FRAME_TONE[band.code];
            const right = (band.endDay + 1) * dayWidthPct;
            return (
              <div
                key={`folders-${band.code}`}
                className="absolute top-1.5 flex gap-1 pointer-events-auto z-10"
                style={{
                  left: `${right}%`,
                  transform: 'translateX(calc(-100% - 0.375rem))',
                }}
              >
                {stages.map(({ stage, label }) => (
                  <Button
                    key={stage}
                    variant="ghost"
                    onClick={() => {
                      void openProductionFolder(row.id, stage).then((res) => {
                        if (!res.ok) {
                          console.warn('[gantt] open folder failed:', res.error);
                          toast.error('Nie udało się otworzyć folderu', {
                            description: res.error,
                          });
                        }
                      });
                    }}
                    aria-label={`Otwórz folder ${label} dla ${displayName}`}
                    title={`Otwórz folder: ${label}`}
                    className={`grid place-items-center w-6 h-6 rounded p-0 border-0 bg-clip-border ${tone.passed} shadow-sm hover:scale-110 hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40`}
                  >
                    <FolderOpen className="size-3.5" />
                  </Button>
                ))}
              </div>
            );
          })}

          {/* Sub-step pins — every step with a user-entered `dateIso` becomes
              a numbered chip on its category's band. The chip sits in the
              middle of the band so it doesn't crowd the T1/T2/T3 corner tag.
              Hover (or keyboard focus) reveals a styled card with: step
              number, label, date, and the full description. */}
          {stagePins.map((pin) => {
            const tone = FRAME_TONE[pin.frame];
            const x = (pin.dayIdx + 0.5) * dayWidthPct;
            const ariaLabel = [
              `Krok ${pin.n}: ${pin.label}`,
              pin.dateLabel,
              pin.description,
            ]
              .filter(Boolean)
              .join(' — ');
            // Vertical offset for same-day pin stacks. 1.875rem ≈ pin
            // height (1.75rem) + 0.125rem gap so neighbours never touch.
            // We center the stack around 50% so a 2-pin stack reads as
            // one above the other within the band.
            const PIN_STACK_SPACING_REM = 1.875;
            const offsetRem =
              (pin.stackIdx - (pin.stackSize - 1) / 2) * PIN_STACK_SPACING_REM;
            return (
              <div
                key={`pin-${pin.stepId}`}
                className="group/pin absolute z-20 pointer-events-auto"
                style={{
                  left: `${x}%`,
                  top: '50%',
                  transform: `translate(-50%, calc(-50% + ${offsetRem}rem))`,
                }}
              >
                {/* vertical guide — thin tick connecting chip to the band edges
                    so the eye can trace the chip back to its calendar day. */}
                <span
                  className={`absolute left-1/2 -translate-x-1/2 -top-4 -bottom-4 w-px ${tone.passed.split(' ')[0]} opacity-40 group-hover/pin:opacity-80 transition`}
                  aria-hidden
                />
                <Button
                  variant="ghost"
                  aria-label={ariaLabel}
                  tabIndex={0}
                  className={`relative grid place-items-center w-7 h-7 rounded-full p-0 bg-clip-border text-[11px] font-bold tabular-nums border-2 border-white shadow-md ring-1 ring-black/5 ${tone.passed} cursor-help group-hover/pin:scale-110 group-hover/pin:shadow-lg group-focus-within/pin:scale-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40`}
                >
                  {pin.n}
                </Button>
                {/* Hover/focus card — appears above the pin with full step
                    context. Uses pointer-events-none so it never traps the
                    cursor; the parent group keeps it visible while the user
                    hovers anywhere within the pin container. */}
                <div
                  role="tooltip"
                  className="opacity-0 group-hover/pin:opacity-100 group-focus-within/pin:opacity-100 transition-opacity duration-150 pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums shadow-sm ${tone.passed}`}
                    >
                      {pin.n}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                      Krok {pin.n}
                    </span>
                  </div>
                  <div className="text-sm font-semibold leading-snug text-foreground">
                    {pin.label}
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {pin.dateLabel}
                  </div>
                  {pin.description ? (
                    <div className="mt-2 pt-2 border-t border-border/70 text-[11.5px] italic text-muted-foreground leading-snug whitespace-pre-wrap">
                      {pin.description}
                    </div>
                  ) : null}
                  {/* Arrow tail pointing down to the chip */}
                  <span
                    aria-hidden
                    className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-popover border-r border-b border-border"
                  />
                </div>
              </div>
            );
          })}
        </div>
  );
}
