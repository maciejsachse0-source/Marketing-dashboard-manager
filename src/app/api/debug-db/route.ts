import { db, schema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** TEMPORARY: dump DB connection info + production count to compare with local */
export async function GET() {
  const url = process.env.DATABASE_URL ?? '';
  const host = url.match(/@([^/]+)/)?.[1] ?? 'unknown';
  const dbName = url.match(/\/([^?]+)\?/)?.[1] ?? 'unknown';
  const prods = await db.query.productions.findMany({ columns: { id: true, slug: true } });
  return Response.json({
    host,
    db: dbName,
    productions: prods,
  });
}
