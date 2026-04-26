'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import type { CalendarEntry, Production } from '../../../drizzle/schema';
import { addDays, formatDayShort, formatHM, startOfWeek, timeUntil } from '@/lib/dates';
import {
  TYPE_LABEL,
  entryClass,
  getContentState,
  type ContentState,
} from './type-color';

const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 56;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;

export type WeekViewProps = {
  weekStart: Date;
  entries: CalendarEntry[];
  productions: Record<number, Production>;
  onEntryClick?: (entry: CalendarEntry) => void;
  onEntryDrop?: (entryId: number, newStartsAt: Date) => void;
};

function entryYPosition(date: Date) {
  const minutes = (date.getHours() - HOUR_START) * 60 + date.getMinutes();
  return Math.max(0, (minutes / 60) * HOUR_HEIGHT);
}

function yToDate(day: Date, y: number, snapMin = SNAP_MINUTES): Date {
  const totalMin = Math.max(0, (y / HOUR_HEIGHT) * 60);
  const snapped = Math.round(totalMin / snapMin) * snapMin;
  const hour = HOUR_START + Math.floor(snapped / 60);
  const minute = snapped % 60;
  const r = new Date(day);
  r.setHours(Math.min(23, hour), minute, 0, 0);
  return r;
}

const STATE_ICON = {
  'planned-empty': Circle,
  'content-ready': Sparkles,
  done: CheckCircle2,
  cancelled: Circle,
} as const;

/**
 * Re-renders every minute so countdown badges ("za 2h", "za 30min") stay live
 * without a heavy ticker on each entry. One tick per minute per page is plenty.
 */
function useNowTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function WeekView({
  weekStart,
  entries,
  productions,
  onEntryClick,
  onEntryDrop,
}: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dayIdx: number; y: number } | null>(null);
  const now = useNowTick();

  const onDragStart = (e: React.DragEvent, entryId: number) => {
    setDraggingId(entryId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(entryId));
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const onColDragOver = (e: React.DragEvent, dayIdx: number) => {
    if (draggingId === null && !onEntryDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDropTarget({ dayIdx, y });
  };

  const onColDrop = (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('text/plain');
    const entryId = Number(idStr);
    if (!Number.isFinite(entryId) || !onEntryDrop) {
      onDragEnd();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const newStartsAt = yToDate(days[dayIdx], y);
    onEntryDrop(entryId, newStartsAt);
    onDragEnd();
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-x-auto shadow-sm">
     <div className="min-w-[700px]">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/40">
        <div />
        {days.map((d) => {
          const isToday = now.toDateString() === d.toDateString();
          return (
            <div
              key={d.toISOString()}
              className={`px-2 py-2.5 text-xs font-medium border-l border-border ${
                isToday
                  ? 'text-primary bg-primary/5 border-b-2 border-b-primary -mb-px'
                  : 'text-muted-foreground'
              }`}
            >
              {formatDayShort(d)}
              {isToday ? <span className="ml-1 text-[9px] uppercase tracking-wider opacity-80">dziś</span> : null}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: TOTAL_HEIGHT }}>
        <div className="relative">
          {hours.slice(0, -1).map((h, i) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-muted-foreground tabular-nums"
              style={{ top: i * HOUR_HEIGHT - 6 }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((d, dayIdx) => {
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);

          const dayEntries = entries.filter((e) => e.startsAt >= dayStart && e.startsAt <= dayEnd);
          const isDropTarget = dropTarget?.dayIdx === dayIdx && draggingId !== null;
          const isToday = now.toDateString() === d.toDateString();

          // Now-line position (only on today's column, only if within shown hours)
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const startMinutes = HOUR_START * 60;
          const endMinutes = HOUR_END * 60;
          const nowY =
            isToday && nowMinutes >= startMinutes && nowMinutes <= endMinutes
              ? ((nowMinutes - startMinutes) / 60) * HOUR_HEIGHT
              : null;

          return (
            <div
              key={d.toISOString()}
              className={`relative border-l border-border transition ${
                isDropTarget ? 'bg-primary/5' : isToday ? 'bg-primary/[0.02]' : ''
              }`}
              onDragOver={(e) => onColDragOver(e, dayIdx)}
              onDragLeave={() => setDropTarget((t) => (t?.dayIdx === dayIdx ? null : t))}
              onDrop={(e) => onColDrop(e, dayIdx)}
            >
              {hours.slice(0, -1).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-b border-border/40 pointer-events-none"
                  style={{ top: (i + 1) * HOUR_HEIGHT, height: 1 }}
                />
              ))}
              {nowY !== null ? (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-rose-500 pointer-events-none z-20 shadow"
                  style={{ top: nowY }}
                  aria-label="teraz"
                >
                  <span className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-card" />
                </div>
              ) : null}
              {isDropTarget ? (
                <div
                  className="absolute left-0 right-0 h-px bg-primary pointer-events-none z-10"
                  style={{ top: dropTarget?.y ?? 0 }}
                >
                  <span className="absolute -top-2 left-1 text-[10px] text-primary bg-background px-1 font-medium tabular-nums">
                    {formatHM(yToDate(d, dropTarget?.y ?? 0))}
                  </span>
                </div>
              ) : null}
              {dayEntries.map((e) => {
                const top = entryYPosition(e.startsAt);
                const minutesDur = Math.max(20, (e.endsAt.getTime() - e.startsAt.getTime()) / 60000);
                const height = (minutesDur / 60) * HOUR_HEIGHT;
                const isDragging = draggingId === e.id;
                const production = e.productionId ? productions[e.productionId] : null;
                const state: ContentState = getContentState(e, production);
                const StateIcon = STATE_ICON[state];
                const showCountdown =
                  e.type === 'publish' && state !== 'done' && state !== 'cancelled';
                const countdown = showCountdown ? timeUntil(e.startsAt, now, 30) : null;
                return (
                  <button
                    key={e.id}
                    type="button"
                    draggable={!!onEntryDrop}
                    onDragStart={(ev) => onDragStart(ev, e.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onEntryClick?.(e)}
                    className={`absolute left-1 right-1 rounded-md px-2 py-1.5 text-left text-xs transition cursor-pointer overflow-hidden ${entryClass(
                      e.type,
                      state,
                    )} ${isDragging ? 'opacity-30' : ''} ${
                      onEntryDrop ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                    style={{ top, height: Math.max(height, 36) }}
                    title={`${e.title} · ${formatHM(e.startsAt)}–${formatHM(e.endsAt)} · ${TYPE_LABEL[e.type]}`}
                  >
                    <div className="flex items-start gap-1 leading-tight">
                      <StateIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.25} />
                      <span className="font-semibold flex-1 line-clamp-2 break-words">{e.title}</span>
                    </div>
                    <div className="text-[10px] mt-1 flex items-center gap-1 opacity-90">
                      <span className="tabular-nums font-medium">{formatHM(e.startsAt)}</span>
                      <span className="opacity-60">·</span>
                      <span className="uppercase tracking-wide opacity-80">{TYPE_LABEL[e.type]}</span>
                      {countdown ? (
                        <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/95 text-current border border-current/30 text-[10px] tabular-nums font-bold shadow-sm">
                          <Clock className="w-2.5 h-2.5" strokeWidth={2.5} /> {countdown}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
     </div>
    </div>
  );
}

export { startOfWeek };
