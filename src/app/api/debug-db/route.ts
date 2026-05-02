import { db, schema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** TEMPORARY: dump DB connection info + production count to compare with local */
export async function GET() {
  const url = process.env.DATABASE_URL ?? '';
  const host = url.match(/@([^/]+)/)?.[1] ?? 'unknown';
  const dbName = url.match(/\/([^?]+)\?/)?.[1] ?? 'unknown';
  const prods = await db.query.productions.findMany({ columns: { id: true, slug: true } });
  // raw SQL probe — see if drizzle ORM is the layer hiding rows
  const sqlClient = (db as unknown as { $client: import('postgres').Sql }).$client;
  const raw = await sqlClient`SELECT id, slug FROM productions ORDER BY id`;
  const rawForId6 = await sqlClient`SELECT id, slug FROM productions WHERE id = 6`;
  return Response.json({
    host,
    db: dbName,
    drizzle_findMany: prods,
    raw_select_all: raw,
    raw_where_id_6: rawForId6,
  });
}
