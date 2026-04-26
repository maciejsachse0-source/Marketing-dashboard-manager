import 'server-only';
import type Database from 'better-sqlite3';
import { db } from '../db';
import type { DashboardWidget } from './types';

/**
 * Runs an agent's read-only widget query and renders the template.
 * Returns `null` if the query isn't a reader (defense in depth — agent JSONs
 * can be edited by the user, but better-sqlite3's `reader` flag rejects
 * INSERT/UPDATE/DELETE so they can't mutate state through this path).
 */
export function runAgentWidget(widget: DashboardWidget): string | null {
  const sqlite = (db as unknown as { $client: Database.Database }).$client;
  let stmt: Database.Statement<unknown[], Record<string, unknown>>;
  try {
    stmt = sqlite.prepare<unknown[], Record<string, unknown>>(widget.query);
  } catch {
    return null;
  }
  if (!stmt.reader) return null;
  let row: Record<string, unknown> | undefined;
  try {
    row = stmt.get();
  } catch {
    return null;
  }
  return widget.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = row?.[key];
    if (v === null || v === undefined) return '0';
    return String(v);
  });
}
