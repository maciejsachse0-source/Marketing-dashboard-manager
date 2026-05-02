/**
 * Pre-create the per-artist work folder layout for every existing
 * production. Skips productions without an artistId — those need to be
 * fixed in the UI first (artist is now required for new productions).
 * Idempotent — safe to re-run after adding new productions or after the
 * OneDrive root resyncs.
 *
 * Usage:
 *   npx tsx scripts/backfill-production-folders.ts
 */
import { db, schema } from '../src/lib/db';
import { desc, eq } from 'drizzle-orm';
import {
  ensureWorkFolderStructure,
  getProductionFolderRoot,
} from '../src/lib/production-work-folder';

async function main() {
  const productions = await db.query.productions.findMany({
    orderBy: desc(schema.productions.t0At),
    columns: { id: true, title: true, artistId: true, periods: true },
  });

  console.log(`[backfill] ${productions.length} produkcji do sprawdzenia`);
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of productions) {
    if (!p.artistId) {
      skipped += 1;
      console.warn(`  - #${p.id} ${p.title}: brak artisty — pomijam`);
      continue;
    }
    const artist = await db.query.artists.findFirst({
      where: eq(schema.artists.id, p.artistId),
      columns: { name: true },
    });
    if (!artist) {
      skipped += 1;
      console.warn(`  - #${p.id} ${p.title}: artysta #${p.artistId} nie istnieje — pomijam`);
      continue;
    }
    try {
      const codes = (p.periods ?? []).map((per) => per.code);
      ensureWorkFolderStructure(
        artist.name,
        p.title,
        codes.length > 0 ? codes : ['T1', 'T2', 'T3'],
      );
      created += 1;
      console.log(`  ✓ #${p.id} ${p.title} → ${getProductionFolderRoot(artist.name, p.title)}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ #${p.id} ${p.title}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[backfill] OK: ${created}, pominięte: ${skipped}, błędy: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
