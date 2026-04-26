import 'server-only';
import { scheduleManager } from './schedule-manager';
import { socialPublisher } from './social-publisher';
import { artistOutreach } from './artist-outreach';
import { viralAnalyzer } from './viral-analyzer';
import { trendScout } from './trend-scout';
import { contentBrief } from './content-brief';
import { campaignStrategist } from './campaign-strategist';
import { weeklyWrap } from './weekly-wrap';
import type { AgentDef, AgentSlug } from './types';

export const AGENTS: Record<AgentSlug, AgentDef> = {
  'schedule-manager': scheduleManager,
  'social-publisher': socialPublisher,
  'artist-outreach': artistOutreach,
  'viral-analyzer': viralAnalyzer,
  'trend-scout': trendScout,
  'content-brief': contentBrief,
  'campaign-strategist': campaignStrategist,
  'weekly-wrap': weeklyWrap,
};

export const AGENT_LIST: AgentDef[] = [
  scheduleManager,
  socialPublisher,
  artistOutreach,
  viralAnalyzer,
  trendScout,
  contentBrief,
  campaignStrategist,
  weeklyWrap,
];

export function getAgent(slug: string): AgentDef | undefined {
  return (AGENTS as Record<string, AgentDef>)[slug];
}

export type { AgentDef, AgentSlug } from './types';
