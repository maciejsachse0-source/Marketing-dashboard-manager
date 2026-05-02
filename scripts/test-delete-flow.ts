/**
 * Mirrors `deleteProduction` server action against Neon directly so we can
 * see what it does without needing the UI / Vercel server-action plumbing.
 * User has authorized destructive testing to debug the delete flow.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  console.log('=== Step 1: list productions ===');
  let prods = await db.query.productions.findMany();
  for (const p of prods) console.log(`  #${p.id} ${p.title}`);

  if (prods.length === 0) {
    console.log('=== Step 2: insert a throwaway test production to delete ===');
    const artist = await db.query.artists.findFirst();
    if (!artist) {
      console.log('no artists in DB, cannot create test prod');
      await sql.end();
      return;
    }
    const [created] = await db
      .insert(schema.productions)
      .values({
        type: 'with-artist',
        title: '__delete-flow-test__',
        slug: '__delete-flow-test__',
        t0At: new Date(),
        steps: [],
        artistId: artist.id,
      })
      .returning();
    console.log('  created prod #', created.id);
    prods = [created];
  }

  const target = prods[0];
  console.log(`\n=== Step 3: mirror deleteProduction(id=${target.id}) ===`);

  const calRefs = await db
    .update(schema.calendarEntries)
    .set({ productionId: null })
    .where(eq(schema.calendarEntries.productionId, target.id))
    .returning({ id: schema.calendarEntries.id });
  console.log(`  nullified calendar_entries: ${calRefs.length}`);

  const postRefs = await db
    .update(schema.posts)
    .set({ productionId: null })
    .where(eq(schema.posts.productionId, target.id))
    .returning({ id: schema.posts.id });
  console.log(`  nullified posts: ${postRefs.length}`);

  const deleted = await db
    .delete(schema.productions)
    .where(eq(schema.productions.id, target.id))
    .returning();
  console.log(`  deleted productions rows: ${deleted.length}`);

  console.log('\n=== Step 4: confirm gone ===');
  const after = await db.query.productions.findMany();
  console.log('  productions left:', after.length);
  for (const p of after) console.log(`    #${p.id} ${p.title}`);

  await sql.end();
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
