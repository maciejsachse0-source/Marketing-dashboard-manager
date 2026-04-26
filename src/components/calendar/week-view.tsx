'use client';

import { useState } from 'react';
import type { CalendarEntry } from '../../../drizzle/schema';
import { addDays, formatDayShort, formatHM, startOfWeek } from '@/lib/dates';
import { TYPE_COLOR, TYPE_LABEL } from './type-color';

const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 56;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;

export type WeekViewProps = {
  weekStart: Date;
  entries: CalendarEntry[];
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

export function WeekView({ weekStart, entries, onEntryClick, onEntryDrop }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dayIdx: number; y: number } | null>(null);

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
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/30">
        <div />
        {days.map((d) => {
          const isToday = new Date().toDateString() === d.toDateString();
          return (
            <div
              key={d.toISOString()}
              className={`px-2 py-2 text-xs font-medium border-l border-border ${
                isToday ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {formatDayShort(d)}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: TOTAL_HEIGHT }}>
        <div className="relative">
          {hours.slice(0, -1).map((h, i) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-muted-foreground"
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

          return (
            <div
              key={d.toISOString()}
              className={`relative border-l border-border transition ${
                isDropTarget ? 'bg-primary/5' : ''
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
                return (
                  <button
                    key={e.id}
                    type="button"
                    draggable={!!onEntryDrop}
                    onDragStart={(ev) => onDragStart(ev, e.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onEntryClick?.(e)}
                    className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-left text-xs transition cursor-pointer ${
                      TYPE_COLOR[e.type]
                    } ${e.status === 'cancelled' ? 'opacity-50 line-through' : ''} ${
                      isDragging ? 'opacity-30' : ''
                    } ${onEntryDrop ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{ top, height: Math.max(height, 28) }}
                  >
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-[10px] opacity-80">
                      {formatHM(e.startsAt)}–{formatHM(e.endsAt)} · {TYPE_LABEL[e.type]}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { startOfWeek };
