'use client';

import { useState } from 'react';
import type { CalendarEntry } from '../../../drizzle/schema';
import { addDays, formatDayShort, formatHM, startOfWeek } from '@/lib/dates';
import { TYPE_COLOR, TYPE_LABEL } from './type-color';

const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 56;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

export type WeekViewProps = {
  weekStart: Date;
  entries: CalendarEntry[];
  onEntryClick?: (entry: CalendarEntry) => void;
};

function entryYPosition(date: Date) {
  const minutes = (date.getHours() - HOUR_START) * 60 + date.getMinutes();
  return Math.max(0, (minutes / 60) * HOUR_HEIGHT);
}

export function WeekView({ weekStart, entries, onEntryClick }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

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
        {days.map((d) => {
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);

          const dayEntries = entries.filter(
            (e) => e.startsAt >= dayStart && e.startsAt <= dayEnd,
          );

          return (
            <div key={d.toISOString()} className="relative border-l border-border">
              {hours.slice(0, -1).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-b border-border/40"
                  style={{ top: (i + 1) * HOUR_HEIGHT, height: 1 }}
                />
              ))}
              {dayEntries.map((e) => {
                const top = entryYPosition(e.startsAt);
                const minutesDur = Math.max(
                  20,
                  (e.endsAt.getTime() - e.startsAt.getTime()) / 60000,
                );
                const height = (minutesDur / 60) * HOUR_HEIGHT;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onEntryClick?.(e)}
                    className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-left text-xs transition cursor-pointer ${
                      TYPE_COLOR[e.type]
                    } ${e.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}
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

export function WeekViewWithState(props: { weekStart: Date; entries: CalendarEntry[] }) {
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  void selected;
  return <WeekView weekStart={props.weekStart} entries={props.entries} onEntryClick={setSelected} />;
}

export { startOfWeek };
