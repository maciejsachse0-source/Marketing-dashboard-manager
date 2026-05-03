'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { GanttRow } from './gantt-view';
import { ProductionStatusPill } from '@/components/productions/status-pill';
import type { ProductionStatus, ProductionStage } from '../../../drizzle/schema';

/**
 * Excel-style alternative to the visual <GanttView />. Renders the same
 * GanttRow[] payload as a dense, sortable-looking spreadsheet — one row per
 * production, one column per pipeline checkpoint date. Useful when the user
 * wants to compare dates across many productions at once without the visual
 * overhead of T-bands and milestone dots.
 */

type StageColumn = {
  key: ProductionStatus;
  label: string;
  short: string;
  category: ProductionStage;
};

// Match the 5 pipeline checkpoints surfaced in the visual gantt. Each shows
// the canonical date (recorded by the user) — the spreadsheet doesn't try to
// surface tentative defaults; if a date isn't set we show "—".
const STAGE_COLUMNS: StageColumn[] = [
  { key: 'cam-meeting-set', label: 'Outreach', short: 'OUTR.', category: 'outreach' },
  { key: 'script-sent', label: 'Ustalenia', short: 'UST.', category: 'ustalenia' },
  { key: 'shooting', label: 'Nagrywka', short: 'NAGR.', category: 'nagrywanie' },
  { key: 'editing', label: 'Obróbka', short: 'MONT.', category: 'obrobka' },
  { key: 'publishing', label: 'Publikacja', short: 'PUB.', category: 'publikacja' },
];

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateOnly(d: Date): string {
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function resolveStageDateIso(row: GanttRow, stage: ProductionStatus): string | null {
  const recorded = row.stepDates?.[stage];
  if (recorded) return recorded;
  // editing auto-derives from shooting + 1 day to mirror the visual gantt
  if (stage === 'editing' && row.stepDates?.shooting) {
    const d = new Date(row.stepDates.shooting);
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (stage === 'publishing') return row.t0At.toISOString();
  return null;
}

export function GanttTableView({ rows }: { rows: GanttRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm px-6 py-10 text-center text-sm text-muted-foreground">
        Brak produkcji w wybranym oknie.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/30 sticky top-0 z-10">
          <tr className="text-left">
            <th className="px-4 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground sticky left-0 bg-muted/30 z-20 min-w-[16rem]">
              Produkcja
            </th>
            <th className="px-3 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Artysta
            </th>
            <th className="px-3 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Kamerzysta
            </th>
            <th className="px-3 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground">
              T-0
            </th>
            <th className="px-3 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Status
            </th>
            <th className="px-3 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Platformy
            </th>
            {STAGE_COLUMNS.map((c) => (
              <th
                key={c.key}
                className="px-3 py-3 border-b border-l border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground tabular-nums whitespace-nowrap"
                title={c.label}
              >
                {c.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const personLabel = row.artistName ?? (row.type === 'solo' ? 'Solo' : '—');
            const platforms = row.platforms ?? [];
            return (
              <tr
                key={row.id}
                className={`group ${i % 2 === 0 ? 'bg-background' : 'bg-muted/10'} hover:bg-foreground/5 transition-colors`}
              >
                <td className="px-4 py-2.5 border-b border-border/60 sticky left-0 bg-inherit z-10 group-hover:bg-foreground/5">
                  <Link
                    href={`/productions/${row.slug}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary"
                  >
                    <span className="truncate max-w-[18rem]">{row.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                  </Link>
                </td>
                <td className="px-3 py-2.5 border-b border-border/60 whitespace-nowrap">
                  {row.artistHandle ? (
                    <span>
                      <span className="font-medium">{personLabel}</span>{' '}
                      <span className="text-muted-foreground text-xs">@{row.artistHandle}</span>
                    </span>
                  ) : (
                    <span className={row.type === 'solo' ? 'text-muted-foreground italic' : ''}>
                      {personLabel}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 border-b border-border/60 whitespace-nowrap">
                  {row.videographerName ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-border/60 tabular-nums whitespace-nowrap font-medium">
                  {formatDateOnly(row.t0At)}
                </td>
                <td className="px-3 py-2.5 border-b border-border/60 whitespace-nowrap">
                  <ProductionStatusPill status={row.status} />
                </td>
                <td className="px-3 py-2.5 border-b border-border/60 whitespace-nowrap">
                  {platforms.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex flex-wrap gap-1">
                      {platforms.map((p) => (
                        <span
                          key={p}
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border bg-muted/40 text-muted-foreground border-border"
                        >
                          {p}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                {STAGE_COLUMNS.map((c) => {
                  const iso = resolveStageDateIso(row, c.key);
                  const isRecorded = !!row.stepDates?.[c.key] || c.key === 'publishing';
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2.5 border-b border-l border-border/60 tabular-nums whitespace-nowrap ${
                        iso ? '' : 'text-muted-foreground'
                      } ${isRecorded ? 'font-medium' : ''}`}
                    >
                      {formatDate(iso)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
