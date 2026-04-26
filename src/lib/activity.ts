import { desc } from 'drizzle-orm';
import { db, schema } from './db';

export type ActivityEvent = {
  kind: 'calendar-entry' | 'post' | 'package' | 'artist' | 'campaign';
  title: string;
  subtitle: string;
  at: Date;
  href: string;
};

export async function getRecentActivity(limit = 10): Promise<ActivityEvent[]> {
  const [calendar, posts, packages, artists, campaigns] = await Promise.all([
    db.query.calendarEntries.findMany({
      orderBy: desc(schema.calendarEntries.createdAt),
      limit: 5,
    }),
    db.query.posts.findMany({
      orderBy: desc(schema.posts.createdAt),
      limit: 5,
    }),
    db.query.packages.findMany({
      orderBy: desc(schema.packages.createdAt),
      limit: 5,
    }),
    db.query.artists.findMany({
      orderBy: desc(schema.artists.createdAt),
      limit: 5,
    }),
    db.query.campaigns.findMany({
      orderBy: desc(schema.campaigns.createdAt),
      limit: 5,
    }),
  ]);

  const events: ActivityEvent[] = [
    ...calendar.map((e) => ({
      kind: 'calendar-entry' as const,
      title: e.title,
      subtitle: `wpis kalendarza · ${e.type}`,
      at: e.createdAt,
      href: '/calendar',
    })),
    ...posts.map((p) => ({
      kind: 'post' as const,
      title: p.title,
      subtitle: `post · ${p.platform}${p.reach ? ` · ${p.reach.toLocaleString('pl-PL')} reach` : ''}`,
      at: p.createdAt,
      href: '/analytics',
    })),
    ...packages.map((p) => ({
      kind: 'package' as const,
      title: p.title,
      subtitle: `pakiet · ${p.status}`,
      at: p.createdAt,
      href: '/packages',
    })),
    ...artists.map((a) => ({
      kind: 'artist' as const,
      title: a.name,
      subtitle: `artysta dodany`,
      at: a.createdAt,
      href: '/artists',
    })),
    ...campaigns.map((c) => ({
      kind: 'campaign' as const,
      title: c.name,
      subtitle: `kampania · faza ${c.phase}`,
      at: c.createdAt,
      href: `/campaigns/${c.id}`,
    })),
  ];

  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
