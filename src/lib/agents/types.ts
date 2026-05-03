import { z } from 'zod';

/** Sidebar/context panel kinds — must match cases in AgentContextPanel. */
export const AGENT_SIDE_PANELS = [
  'calendar-14',
  'recent-posts',
  'artists-list',
  'active-campaigns',
  'trend-bookmarks',
] as const;

export type AgentSidePanel = (typeof AGENT_SIDE_PANELS)[number];

export type AgentSlug = string;

/**
 * Dashboard-widget kinds. Each kind maps to a hand-written Drizzle query
 * inside `widget.ts`. We deliberately do NOT let the user write SQL —
 * earlier iterations used `tx.unsafe()` on agent-supplied SQL gated only
 * by a regex, which let any authenticated user read anything the postgres
 * role could see (incl. pg_settings) by editing an agent's widget query.
 */
export const WIDGET_KINDS = [
  'stale-artists',
  'upcoming-campaigns',
  'overdue-calendar-entries',
  'recent-csv-uploads',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export type DashboardWidget = {
  kind: WidgetKind;
  /** Days lookback for kinds that take a window (stale-artists, recent-csv-uploads). Ignored otherwise. */
  days?: number;
  /** Mustache-lite template — `{{count}}` is the only available placeholder. */
  template: string;
};

export type AgentDef = {
  slug: AgentSlug;
  name: string;
  description: string;
  systemPrompt: string;
  sidePanel: AgentSidePanel;
  dashboardWidget?: DashboardWidget | null;
};

/** Client-safe metadata — no system prompt, no widget config. */
export type AgentMeta = Pick<AgentDef, 'slug' | 'name' | 'description' | 'sidePanel'>;

const slugSchema = z
  .string()
  .min(2, 'min 2 znaki')
  .max(48, 'max 48 znaków')
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'tylko małe litery, cyfry i myślniki');

export const dashboardWidgetSchema: z.ZodType<DashboardWidget> = z.object({
  kind: z.enum(WIDGET_KINDS),
  days: z.number().int().min(1).max(365).optional(),
  template: z.string().min(1, 'template wymagany').max(140),
});

export const agentDefSchema: z.ZodType<AgentDef> = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  systemPrompt: z.string().min(1),
  sidePanel: z.enum(AGENT_SIDE_PANELS),
  dashboardWidget: dashboardWidgetSchema.nullable().optional(),
});
