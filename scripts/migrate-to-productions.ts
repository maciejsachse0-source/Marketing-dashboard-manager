import 'dotenv/config';
import { isNull, eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/db';
import type { CalendarType, ProductionStatus, ProductionType } from '../drizzle/schema';

function safeSlug(input: string, fallback: string): string {
  const s = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return s || fallback;
}

function mapStatus(entryType: CalendarType, entryStatus: 'planned' | 'done' | 'cancelled'): ProductionStatus {
  if (entryStatus === 'cancelled') return 'cancelled';
  if (entryStatus === 'done') {
    if (entryType === 'publish') return 'publishing';
    if (entryType === 'shoot' || entryType === 'edit') return 'editing';
    return 'email-sent';
  }
  // planned
  switch (entryType) {
    case 'shoot':
      return 'script-sent';
    case 'edit':
      return 'editing';
    case 'publish':
      return 'publishing';
    case 'meeting':
      return 'cam-meeting-set';
    case 'deadline':
      return 'cam-meeting-set';
    default:
      return 'email-sent';
  }
}

async function main() {
  const orphans = await db.query.calendarEntries.findMany({
    where: isNull(schema.calendarEntries.productionId),
  });

  console.log(`[migrate] found ${orphans.length} calendar entries without production`);

  let created = 0;

  for (const entry of orphans) {
    const type: ProductionType = entry.artistId ? 'with-artist' : 'solo';
    const status = mapStatus(entry.type, entry.status);
    const slugBase = safeSlug(entry.title, `entry-${entry.id}`);
    const slug = `${slugBase}-${entry.id}`;

    const [prod] = await db
      .insert(schema.productions)
      .values({
        type,
        templateSlug: 'manual',
        status,
        title: entry.title,
        slug,
        t0At: entry.startsAt,
        artistId: entry.artistId,
        platforms: entry.platforms,
        campaignId: entry.campaignId,
      })
      .returning();

    await db
      .update(schema.calendarEntries)
      .set({ productionId: prod.id })
      .where(eq(schema.calendarEntries.id, entry.id));

    created++;
    console.log(`  ✓ #${entry.id} "${entry.title}" → production #${prod.id} (${type}, ${status})`);
  }

  console.log(`[migrate] created ${created} productions`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
