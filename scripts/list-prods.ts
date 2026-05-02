import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });
  const prods = await db.query.productions.findMany();
  console.log('count:', prods.length);
  for (const p of prods) console.log(`  #${p.id} ${p.title} slug=${p.slug}`);
  await sql.end();
}
main();
