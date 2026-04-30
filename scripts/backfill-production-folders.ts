/**
 * Pre-create the work folder layout (nagrywanie/, obrobka/, publikacja/ +
 * nested subfolders) for every existing production. Idempotent — safe to
 * re-run after adding new productions or after wiping the data/files tree.
 *
 * Usage:
 *   npx tsx scripts/backfill-production-folders.ts
 */
import { db, schema } from '../src/lib/db';
import { desc } from 'drizzle-orm';
import { ensureWorkFolderStructure } from '../src/lib/production-work-folder';

async function main() {
  const productions = await db.query.productions.findMany({
    orderBy: desc(schema.productions.t0At),
    columns: { id: true, title: true, slug: true },
  });

  console.log(`[backfill] ${productions.length} produkcji do sprawdzenia`);
  let created = 0;
  let failed = 0;
  for (const p of productions) {
    try {
      ensureWorkFolderStructure(p.slug);
      created += 1;
      console.log(`  ✓ #${p.id} ${p.title} → data/files/productions/${p.slug}/`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ #${p.id} ${p.title}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[backfill] OK: ${created}, błędy: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
