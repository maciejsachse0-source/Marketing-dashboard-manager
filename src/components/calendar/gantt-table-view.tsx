'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { GanttRow } from './gantt-view';
import { ProductionStatusPill, STATUS_LABEL } from '@/components/productions/status-pill';
import { STAGE_HINT } from '@/lib/production-stages';
import type { ProductionStatus, ProductionStage } from '../../../drizzle/schema';
import { PRODUCTION_PROGRESSION } from '../../../drizzle/schema';

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

/** Each canonical sub-stage rolls up to one of the 5 main milestones — same
 *  mapping the visual gantt uses, kept local so this view stays decoupled. */
const STAGE_TO_CATEGORY: Record<ProductionStatus, ProductionStage | null> = {
  'email-sent': 'outreach',
  'terms-accepted': 'outreach',
  'cam-meeting-set': 'outreach',
  'cam-date-shared': 'ustalenia',
  'script-discussed': 'ustalenia',
  'script-sent': 'ustalenia',
  shooting: 'nagrywanie',
  editing: 'obrobka',
  publishing: 'publikacja',
  cancelled: null,
};

const CATEGORY_LABEL: Record<ProductionStage, string> = {
  outreach: 'Outreach',
  ustalenia: 'Ustalenia',
  nagrywanie: 'Nagrywanie',
  obrobka: 'Obróbka',
  publikacja: 'Publikacja',
};

const CATEGORY_TONE: Record<ProductionStage, string> = {
  outreach: 'text-amber-700',
  ustalenia: 'text-amber-700',
  nagrywanie: 'text-blue-700',
  obrobka: 'text-emerald-700',
  publikacja: 'text-cyan-700',
};

const CANONICAL_TOTAL = PRODUCTION_PROGRESSION.length; // 9 canonical steps

function countDoneCanonical(row: GanttRow): number {
  const set = new Set<string>(PRODUCTION_PROGRESSION);
  return (row.steps ?? []).filter((s) => set.has(s.id) && s.doneAt).length;
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
            <th className="px-3 py-3 border-b border-border font-semibold text-xs uppercase tracking-[0.12em] text-muted-foreground min-w-[14rem]">
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
                <td className="px-3 py-2.5 border-b border-border/60 align-top">
                  <StatusCell row={row} />
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

/**
 * Status column body — three layers of context:
 *   1. Main milestone label (category) tinted with the same family color used
 *      by the visual gantt's T-bands, so users carry a mental map between
 *      views.
 *   2. Status pill — same component the rest of the app uses, surfaces the
 *      current sub-stage label.
 *   3. STAGE_HINT description — one-line "what does this stage mean" copy.
 *   4. Tiny progress hint "X/9 kroków" so the cell answers both "where am I"
 *      and "how far along".
 *
 * Cancelled productions short-circuit to a single rose-tinted line — the
 * milestone hierarchy doesn't apply once the production is killed.
 */
function StatusCell({ row }: { row: GanttRow }) {
  if (row.cancelled || row.status === 'cancelled') {
    return (
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-rose-700">
          Anulowane
        </div>
        <ProductionStatusPill status="cancelled" />
      </div>
    );
  }

  const category = STAGE_TO_CATEGORY[row.status];
  const categoryLabel = category ? CATEGORY_LABEL[category] : '—';
  const categoryTone = category ? CATEGORY_TONE[category] : 'text-muted-foreground';
  const hint = STAGE_HINT[row.status];
  const subLabel = STATUS_LABEL[row.status];
  const done = countDoneCanonical(row);

  return (
    <div className="space-y-1 leading-snug">
      <div className={`text-[10px] uppercase tracking-[0.12em] font-bold ${categoryTone}`}>
        {categoryLabel}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ProductionStatusPill status={row.status} />
        <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
          {done}/{CANONICAL_TOTAL} kroków
        </span>
      </div>
      {hint ? (
        <div
          className="text-[11px] text-muted-foreground max-w-[18rem] line-clamp-2"
          title={`${subLabel} — ${hint}`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
