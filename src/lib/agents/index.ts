import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import {
  agentDefSchema,
  WIDGET_KINDS,
  type AgentDef,
  type AgentMeta,
  type AgentSlug,
  type DashboardWidget,
} from './types';

/**
 * Coerces the persisted dashboardWidget JSON to the current shape. Drops
 * the legacy `{query, template}` shape (used to be raw SQL run via
 * tx.unsafe — replaced with a kind-based enum in the widget refactor).
 * Returning null instead of throwing keeps the dashboard rendering when
 * an old row is encountered; user can re-pick a kind via the agent edit
 * form to re-enable the widget.
 */
function coerceWidget(value: unknown): DashboardWidget | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.kind === 'string' && (WIDGET_KINDS as readonly string[]).includes(v.kind)) {
    return value as DashboardWidget;
  }
  return null;
}

/**
 * Reads + validates every agent row from Postgres on each call. Validation
 * stays via Zod so the in-DB shape is enforced the same way the legacy
 * `data/agents/<slug>.json` files were.
 */
export async function loadAgents(): Promise<AgentDef[]> {
  const rows = await db.query.agents.findMany({
    orderBy: schema.agents.slug,
  });
  const out: AgentDef[] = [];
  for (const row of rows) {
    const candidate = {
      slug: row.slug,
      name: row.name,
      description: row.description,
      systemPrompt: row.systemPrompt,
      sidePanel: row.sidePanel,
      dashboardWidget: coerceWidget(row.dashboardWidget),
    };
    const result = agentDefSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error(
        `Agent "${row.slug}" w bazie nie przeszedł walidacji: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    out.push(result.data);
  }
  return out;
}

export async function loadAgentMeta(): Promise<AgentMeta[]> {
  const all = await loadAgents();
  return all.map(({ slug, name, description, sidePanel }) => ({
    slug,
    name,
    description,
    sidePanel,
  }));
}

export async function getAgent(slug: string): Promise<AgentDef | undefined> {
  const row = await db.query.agents.findFirst({
    where: eq(schema.agents.slug, slug),
  });
  if (!row) return undefined;
  const candidate = {
    slug: row.slug,
    name: row.name,
    description: row.description,
    systemPrompt: row.systemPrompt,
    sidePanel: row.sidePanel,
    dashboardWidget: coerceWidget(row.dashboardWidget),
  };
  const result = agentDefSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `Agent "${slug}" w bazie nie przeszedł walidacji: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
}

export type { AgentDef, AgentMeta, AgentSlug } from './types';
