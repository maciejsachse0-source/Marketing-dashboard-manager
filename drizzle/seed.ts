import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { resolve } from 'node:path';
import * as schema from './schema';

const dbPath = resolve(process.env.DATABASE_PATH ?? './data/marketing-crew.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

const now = new Date();
function daysFromNow(days: number, hour = 12, minute = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log('[seed] inserting test data');

  const artists = await db
    .insert(schema.artists)
    .values([
      { name: 'Anna Test', handle: '@ania.test', email: 'ania@example.com', notes: 'Wokalistka, premiera EP w czerwcu.' },
      { name: 'Marek Demo', handle: '@marekbeats', email: 'marek@example.com', notes: 'Producent, kolab w planach.' },
    ])
    .returning();

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      name: 'Premiera singla "Świt"',
      goal: 'Premiera singla — 250k reach, 5% ER',
      releaseAt: daysFromNow(30, 18, 0),
      phase: 'build-up',
      kpis: { reach: 250000, engagementRate: 5 },
      notes: 'Single drop wt-czw, content T-30 do T+30.',
    })
    .returning();

  await db.insert(schema.calendarEntries).values([
    {
      type: 'shoot',
      title: 'Nagranie BTS — sesja w studio',
      description: 'Behind the scenes z Anią, krótkie ujęcia 15s pod IG/TT.',
      startsAt: daysFromNow(2, 14, 0),
      endsAt: daysFromNow(2, 18, 0),
      platforms: ['instagram', 'tiktok'],
      artistId: artists[0].id,
      campaignId: campaign.id,
      status: 'planned',
    },
    {
      type: 'edit',
      title: 'Montaż BTS',
      startsAt: daysFromNow(3, 10, 0),
      endsAt: daysFromNow(3, 14, 0),
      campaignId: campaign.id,
      status: 'planned',
    },
    {
      type: 'publish',
      title: 'Publikacja BTS — IG Reels',
      startsAt: daysFromNow(5, 19, 0),
      endsAt: daysFromNow(5, 19, 30),
      platforms: ['instagram'],
      campaignId: campaign.id,
      status: 'planned',
    },
    {
      type: 'meeting',
      title: 'Call z Markiem — kolab planowanie',
      startsAt: daysFromNow(4, 16, 0),
      endsAt: daysFromNow(4, 17, 0),
      artistId: artists[1].id,
      status: 'planned',
    },
    {
      type: 'deadline',
      title: 'Deadline — teaser singla gotowy',
      startsAt: daysFromNow(7, 23, 59),
      endsAt: daysFromNow(7, 23, 59),
      campaignId: campaign.id,
      status: 'planned',
    },
  ]);

  console.log('[seed] done');
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
