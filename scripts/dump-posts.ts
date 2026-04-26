import 'dotenv/config';
import { db, schema } from '../src/lib/db';

async function main() {
  const posts = await db.query.posts.findMany({ orderBy: schema.posts.publishedAt });
  console.log(`=== POSTS (${posts.length}) ===`);
  for (const p of posts) {
    console.log(
      `#${p.id} [${p.platform}] ${p.publishedAt.toISOString().slice(0, 10)} "${p.title}" reach=${p.reach ?? '?'} ER=${p.engagementRate ?? '?'} comm=${p.comments ?? '?'} shares=${p.shares ?? '?'} saves=${p.saves ?? '?'} csvRow=${p.rawCsvRowId ?? '—'}`,
    );
  }
}

main().then(() => process.exit(0));
