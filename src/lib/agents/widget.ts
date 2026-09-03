import 'server-only';
import { and, count, gte, isNull, lt, or, ne, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { DashboardWidget } from './types';

/**
 * Runs an agent's dashboard widget. Replaces the previous tx.unsafe()
 * approach (which executed agent-supplied SQL gated only by a regex —
 * trivially evadable, escalated any authenticated user to read-only DB
 * access against the postgres role). Each widget kind maps to a fixed
 * Drizzle query here; the user controls only the template string and
 * an optional days window.
 *
 * Returns `null` if the kind is unknown (silent fail keeps the dashboard
 * rendering even with stale agent JSONs from before this refactor).
 */
export async function runAgentWidget(widget: DashboardWidget): Promise<string | null> {
  let value: number;
  try {
    value = await runQuery(widget);
  } catch {
    return null;
  }
  return widget.template.replace(/\{\{count\}\}/g, String(value));
}

/** Wynik zapytania `select({ c: count() })`: brak wiersza znaczy zero. */
function firstCount(rows: { c: number }[]): number {
  return Number(rows[0]?.c ?? 0);
}

async function runQuery(widget: DashboardWidget): Promise<number> {
  const days = widget.days ?? defaultDays(widget.kind);
  switch (widget.kind) {
    case 'stale-artists': {
      const cutoff = new Date(Date.now() - days * 86_400_000);
      const rows = await db
        .select({ c: count() })
        .from(schema.artists)
        .where(or(isNull(schema.artists.lastContactAt), lt(schema.artists.lastContactAt, cutoff)));
      return firstCount(rows);
    }
    case 'upcoming-campaigns': {
      const rows = await db
        .select({ c: count() })
        .from(schema.campaigns)
        .where(and(ne(schema.campaigns.phase, 'done'), gte(schema.campaigns.releaseAt, new Date())));
      return firstCount(rows);
    }
    case 'overdue-calendar-entries': {
      const rows = await db
        .select({ c: count() })
        .from(schema.calendarEntries)
        .where(
          sql`${schema.calendarEntries.startsAt} < now() AND ${schema.calendarEntries.status} = 'planned'`,
        );
      return firstCount(rows);
    }
    case 'recent-csv-uploads': {
      const cutoff = new Date(Date.now() - days * 86_400_000);
      const rows = await db
        .select({ c: count() })
        .from(schema.csvUploads)
        .where(gte(schema.csvUploads.uploadedAt, cutoff));
      return firstCount(rows);
    }
    default: {
      const _exhaustive: never = widget.kind;
      void _exhaustive;
      return 0;
    }
  }
}

function defaultDays(kind: DashboardWidget['kind']): number {
  switch (kind) {
    case 'stale-artists':
      return 14;
    case 'recent-csv-uploads':
      return 7;
    default:
      return 0;
  }
}

export const WIDGET_KIND_LABELS: Record<DashboardWidget['kind'], string> = {
  'stale-artists': 'Artyści bez kontaktu od N dni',
  'upcoming-campaigns': 'Nadchodzące kampanie',
  'overdue-calendar-entries': 'Zaległe wpisy kalendarza',
  'recent-csv-uploads': 'CSV w ostatnich N dniach',
};
