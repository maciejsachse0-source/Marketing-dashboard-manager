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

export type DashboardWidget = {
  /** Parameterless SELECT that yields a single row with named columns. Read-only. */
  query: string;
  /** Mustache-lite template — `{{column}}` is interpolated from the row. */
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

/** Client-safe metadata — no system prompt, no widget query. */
export type AgentMeta = Pick<AgentDef, 'slug' | 'name' | 'description' | 'sidePanel'>;

const slugSchema = z
  .string()
  .min(2, 'min 2 znaki')
  .max(48, 'max 48 znaków')
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'tylko małe litery, cyfry i myślniki');

export const dashboardWidgetSchema = z.object({
  query: z.string().min(10, 'query za krótki'),
  template: z.string().min(1, 'template wymagany'),
});

export const agentDefSchema: z.ZodType<AgentDef> = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  systemPrompt: z.string().min(1),
  sidePanel: z.enum(AGENT_SIDE_PANELS),
  dashboardWidget: dashboardWidgetSchema.nullable().optional(),
});
