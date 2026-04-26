import type { AgentSlug, AgentSidePanel } from './types';

export type AgentMeta = {
  slug: AgentSlug;
  name: string;
  description: string;
  sidePanel: AgentSidePanel;
};

/**
 * Client-safe registry — only static metadata, no system prompts and no
 * contextLoader functions (which would drag in server-only deps like
 * better-sqlite3 into client bundles).
 *
 * Keep in sync with src/lib/agents/<slug>.ts.
 */
export const AGENT_META: AgentMeta[] = [
  {
    slug: 'schedule-manager',
    name: 'Schedule Manager',
    description: 'Planuje nagrania, montaż i publikacje. Wykrywa kolizje w kalendarzu.',
    sidePanel: 'calendar-14',
  },
  {
    slug: 'social-publisher',
    name: 'Social Publisher',
    description: 'Pisze copy publikacyjne — hooki, captiony, hashtagi, CTA per platforma.',
    sidePanel: 'recent-packages',
  },
  {
    slug: 'artist-outreach',
    name: 'Artist Outreach',
    description: 'Pisze maile do artystów — cold, zaproszenia, briefy, follow-upy, podziękowania.',
    sidePanel: 'artists-list',
  },
  {
    slug: 'viral-analyzer',
    name: 'Viral Analyzer',
    description: 'Analizuje wyniki postów. Wyciąga wnioski które zmieniają następny post.',
    sidePanel: 'recent-posts',
  },
  {
    slug: 'trend-scout',
    name: 'Trend Scout',
    description: 'Znajduje trending formaty, audio i tematy. Dopasowuje do contentu użytkownika.',
    sidePanel: 'trend-bookmarks',
  },
  {
    slug: 'content-brief',
    name: 'Content Brief',
    description: 'Tworzy briefy produkcyjne — ekipa wchodzi na plan i wie co robić.',
    sidePanel: 'brief-templates',
  },
  {
    slug: 'campaign-strategist',
    name: 'Campaign Strategist',
    description: 'Strateg kampanii — sekwencja contentu prowadząca do premiery / kolaby / launchu.',
    sidePanel: 'active-campaigns',
  },
  {
    slug: 'weekly-wrap',
    name: 'Weekly Wrap',
    description: 'Cotygodniowy raport: co było, co działa, co przed nami, co wymaga decyzji.',
    sidePanel: 'wrap-history',
  },
];
