import 'dotenv/config';
import { db, schema } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import { setProductionStatus } from '../src/server/actions/productions';

async function main() {
  // Link existing package #1 (BTS sesja) to existing production #1 ("Nagranie BTS")
  await db.update(schema.packages).set({ productionId: 1 }).where(eq(schema.packages.id, 1));
  console.log('linked package #1 → production #1');

  // Set production #1 status to publishing → triggers folder generation
  const result = await setProductionStatus(1, 'publishing');
  console.log('production #1 status:', result.status);

  // Read it back to see folderPath
  const fresh = await db.query.productions.findFirst({ where: eq(schema.productions.id, 1) });
  console.log('folderPath:', fresh?.folderPath);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
