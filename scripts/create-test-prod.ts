import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });
  const artist = await db.query.artists.findFirst();
  if (!artist) {
    console.log('no artists');
    await sql.end();
    return;
  }
  const [created] = await db
    .insert(schema.productions)
    .values({
      type: 'with-artist',
      title: '__delete-test__',
      slug: '__delete-test__-' + Date.now(),
      t0At: new Date(),
      steps: [],
      artistId: artist.id,
    })
    .returning();
  console.log('created:', created.id);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
