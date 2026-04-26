'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, Sparkles, User, Camera, FolderCheck } from 'lucide-react';
import type { CalendarEntry, Platform } from '../../../drizzle/schema';
import { addDays, formatDayShort, formatHM, startOfWeek, timeUntil } from '@/lib/dates';
import {
  TYPE_LABEL,
  entryClass,
  getContentState,
  type ContentState,
} from './type-color';
import {
  tOffsetLabel,
  type ProductionMeta,
} from './production-meta';

const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 56;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;

/** Visible-info buckets — drives how much to render in a tile. */
const SIZE_COMPACT_PX = 50;   // ≤ 50px = ~30 min: just title + time
const SIZE_STANDARD_PX = 110; // 50-110 = ~30-90 min: + production + countdown
                              // > 110 = full meta (artist, platforms)

export type WeekViewProps = {
  weekStart: Date;
  entries: CalendarEntry[];
  productions: Record<number, ProductionMeta>;
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

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  facebook: 'FB',
  x: 'X',
  linkedin: 'LI',
};

/**
 * Re-renders every minute so countdown badges and the now-line stay live
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
              {dayEntries.map((e) => (
                <EntryTile
                  key={e.id}
                  entry={e}
                  production={e.productionId ? productions[e.productionId] ?? null : null}
                  now={now}
                  isDragging={draggingId === e.id}
                  draggable={!!onEntryDrop}
                  onDragStart={(ev) => onDragStart(ev, e.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onEntryClick?.(e)}
                />
              ))}
            </div>
          );
        })}
      </div>
     </div>
    </div>
  );
}

function EntryTile({
  entry: e,
  production,
  now,
  isDragging,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  entry: CalendarEntry;
  production: ProductionMeta | null;
  now: Date;
  isDragging: boolean;
  draggable: boolean;
  onDragStart: (ev: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const top = entryYPosition(e.startsAt);
  const minutesDur = Math.max(20, (e.endsAt.getTime() - e.startsAt.getTime()) / 60000);
  const heightRaw = (minutesDur / 60) * HOUR_HEIGHT;
  const height = Math.max(heightRaw, 36);

  const state: ContentState = getContentState(e, production);
  const StateIcon = STATE_ICON[state];

  const showCountdown =
    e.type === 'publish' && state !== 'done' && state !== 'cancelled';
  const countdown = showCountdown ? timeUntil(e.startsAt, now, 30) : null;

  const platforms: Platform[] | null = e.platforms ?? production?.platforms ?? null;

  // Production "anchor" — title + T-offset. Deliberately compact so it fits.
  const productionAnchor = production
    ? {
        title: production.title,
        offset: tOffsetLabel(e.startsAt, production.t0At),
      }
    : null;

  // Tooltip — full info regardless of size.
  const tooltipParts = [
    e.title,
    `${formatHM(e.startsAt)}–${formatHM(e.endsAt)} (${formatDuration(minutesDur)})`,
    TYPE_LABEL[e.type],
    productionAnchor ? `↳ ${productionAnchor.title} · ${productionAnchor.offset}` : null,
    production?.artistName
      ? `${production.artistName}${production.artistHandle ? ` (${production.artistHandle})` : ''}`
      : null,
    production?.videographerName ? `kamerzysta: ${production.videographerName}` : null,
    platforms?.length ? `platformy: ${platforms.join(', ')}` : null,
    e.description ? `\n${e.description}` : null,
  ].filter(Boolean) as string[];

  const showProduction = height >= SIZE_COMPACT_PX && productionAnchor;
  const showArtist =
    height >= SIZE_STANDARD_PX && (production?.artistName || production?.videographerName);
  const showPlatforms = height >= SIZE_STANDARD_PX && platforms && platforms.length > 0;
  const tightVertical = height < SIZE_COMPACT_PX;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-md text-left text-xs transition cursor-pointer overflow-hidden ${entryClass(
        e.type,
        state,
      )} ${isDragging ? 'opacity-30' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        tightVertical ? 'px-1.5 py-1' : 'px-2 py-1.5'
      }`}
      style={{ top, height }}
      title={tooltipParts.join('\n')}
    >
      {/* Row 1: state icon + title + countdown badge (always visible) */}
      <div className="flex items-start gap-1 leading-tight">
        <StateIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.25} />
        <span
          className={`font-semibold flex-1 break-words ${tightVertical ? 'truncate' : 'line-clamp-2'}`}
        >
          {e.title}
        </span>
        {countdown ? (
          <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/95 text-current border border-current/30 text-[10px] tabular-nums font-bold shadow-sm">
            <Clock className="w-2.5 h-2.5" strokeWidth={2.5} /> {countdown}
          </span>
        ) : null}
      </div>

      {/* Row 2: time + type — collapses on tight tiles */}
      <div
        className={`flex items-center gap-1 opacity-90 ${tightVertical ? 'text-[10px] mt-0.5' : 'text-[10px] mt-1'}`}
      >
        <span className="tabular-nums font-medium">{formatHM(e.startsAt)}</span>
        {!tightVertical ? (
          <>
            <span className="opacity-50">→</span>
            <span className="tabular-nums opacity-80">{formatHM(e.endsAt)}</span>
          </>
        ) : null}
        <span className="opacity-50">·</span>
        <span className="uppercase tracking-wide opacity-80 truncate">{TYPE_LABEL[e.type]}</span>
      </div>

      {/* Row 3: production anchor (Świt · T-7) */}
      {showProduction && productionAnchor ? (
        <div className="flex items-center gap-1 mt-1 text-[10px] opacity-95 leading-tight">
          <span className="opacity-60 shrink-0">↳</span>
          <span className="font-semibold truncate flex-1">{productionAnchor.title}</span>
          <span className="shrink-0 px-1 py-px rounded bg-current/15 font-bold tabular-nums tracking-wide">
            {productionAnchor.offset}
          </span>
        </div>
      ) : null}

      {/* Row 4: artist / videographer */}
      {showArtist ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] opacity-85 leading-tight">
          {production?.artistName ? (
            <span className="inline-flex items-center gap-0.5">
              <User className="w-2.5 h-2.5 opacity-70" strokeWidth={2.25} />
              <span className="truncate max-w-[100px]">
                {production.artistHandle ?? production.artistName}
              </span>
            </span>
          ) : null}
          {production?.videographerName ? (
            <span className="inline-flex items-center gap-0.5">
              <Camera className="w-2.5 h-2.5 opacity-70" strokeWidth={2.25} />
              <span className="truncate max-w-[80px]">{production.videographerName}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Row 5: platforms (mostly publish entries) */}
      {showPlatforms && platforms ? (
        <div className="flex flex-wrap items-center gap-0.5 mt-1">
          {platforms.slice(0, 4).map((p) => (
            <span
              key={p}
              className="text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded bg-white/85 text-current border border-current/20"
            >
              {PLATFORM_LABEL[p]}
            </span>
          ))}
          {platforms.length > 4 ? (
            <span className="text-[9px] opacity-70">+{platforms.length - 4}</span>
          ) : null}
        </div>
      ) : null}

      {/* Row 6 (large tiles only): folder ready hint for content-ready publishes */}
      {height >= SIZE_STANDARD_PX && state === 'content-ready' && e.type === 'publish' && production?.folderPath ? (
        <div className="flex items-center gap-1 mt-1 text-[10px] opacity-90">
          <FolderCheck className="w-2.5 h-2.5" strokeWidth={2.25} />
          <span className="font-medium">folder gotowy</span>
        </div>
      ) : null}
    </button>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export { startOfWeek };
