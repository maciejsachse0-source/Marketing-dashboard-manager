import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // also fall through to .env if .env.local is absent
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log('[migrate] applying migrations');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('[migrate] done');

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
