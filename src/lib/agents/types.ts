import 'server-only';

export type AgentSlug =
  | 'schedule-manager'
  | 'social-publisher'
  | 'artist-outreach'
  | 'viral-analyzer'
  | 'trend-scout'
  | 'content-brief'
  | 'campaign-strategist'
  | 'weekly-wrap';

export type AgentSidePanel =
  | 'calendar-14'
  | 'recent-posts'
  | 'artists-list'
  | 'brief-templates'
  | 'active-campaigns'
  | 'wrap-history'
  | 'trend-bookmarks'
  | 'recent-packages';

export type AgentDef = {
  slug: AgentSlug;
  name: string;
  description: string;
  /** Sidebar status — 1 line, dynamic. Optional helper for dashboard tile. */
  statusHint?: string;
  systemPrompt: string;
  /** Loads context appended to system prompt at request time. */
  contextLoader: () => Promise<string>;
  /** Which side panel UI shows next to this agent's chat. */
  sidePanel: AgentSidePanel;
};
