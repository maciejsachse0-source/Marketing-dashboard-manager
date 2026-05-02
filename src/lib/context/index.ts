import { and, desc, gte, lte, eq, isNotNull } from 'drizzle-orm';
import { db, schema } from '../db';

export async function getUpcomingCalendar(days = 14) {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db.query.calendarEntries.findMany({
    where: and(
      gte(schema.calendarEntries.startsAt, now),
      lte(schema.calendarEntries.startsAt, horizon),
    ),
    orderBy: schema.calendarEntries.startsAt,
    limit: 100,
  });
}

export async function getRecentPosts(limit = 10) {
  return db.query.posts.findMany({
    orderBy: desc(schema.posts.publishedAt),
    limit,
  });
}

export async function getPostsWithMetrics(limit = 20) {
  return db.query.posts.findMany({
    where: isNotNull(schema.posts.reach),
    orderBy: desc(schema.posts.publishedAt),
    limit,
  });
}

export async function getActiveCampaigns() {
  return db.query.campaigns.findMany({
    orderBy: desc(schema.campaigns.releaseAt),
    limit: 20,
  });
}

export async function getAllArtists() {
  return db.query.artists.findMany({
    orderBy: desc(schema.artists.lastContactAt),
    limit: 200,
  });
}

export async function getArtistByName(name: string) {
  return db.query.artists.findFirst({
    where: eq(schema.artists.name, name),
  });
}

export async function getRecentAgentRuns(agentSlug: string, limit = 5) {
  return db.query.agentRuns.findMany({
    where: eq(schema.agentRuns.agentSlug, agentSlug),
    orderBy: desc(schema.agentRuns.createdAt),
    limit,
  });
}

export async function getCampaignById(id: number) {
  return db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, id),
  });
}
