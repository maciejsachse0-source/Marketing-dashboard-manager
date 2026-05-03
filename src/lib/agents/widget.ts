import 'server-only';
import type { Sql } from 'postgres';
import { db } from '../db';
import type { DashboardWidget } from './types';

/**
 * Runs an agent's read-only widget query and renders the template.
 * Returns `null` if the query isn't a single SELECT (defense in depth — agent
 * JSONs can be edited by the user, so we refuse anything that could mutate
 * state). The query also runs inside a READ ONLY transaction as a belt-and-
 * suspenders measure.
 */
export async function runAgentWidget(widget: DashboardWidget): Promise<string | null> {
  const trimmed = widget.query.trim().replace(/;\s*$/, '');
  if (!/^select\s/i.test(trimmed)) return null;
  if (/;/.test(trimmed)) return null; // refuse multi-statement strings

  const sql = (db as unknown as { $client: Sql }).$client;
  let row: Record<string, unknown> | undefined;
  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET TRANSACTION READ ONLY');
      return tx.unsafe(trimmed);
    });
    row = (rows as unknown as Record<string, unknown>[])[0];
  } catch {
    return null;
  }
  return widget.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = row?.[key];
    if (v === null || v === undefined) return '0';
    return String(v);
  });
}
