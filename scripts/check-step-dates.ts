import { db, schema } from '../src/lib/db';
import { eq } from 'drizzle-orm';

async function main() {
  const row = await db.query.productions.findFirst({
    where: eq(schema.productions.id, 1),
  });
  console.log('drizzle stepDates:', row?.stepDates);
  console.log('typeof:', typeof row?.stepDates);
  console.log('JSON:', JSON.stringify(row?.stepDates));
  if (row?.stepDates) {
    console.log('shooting:', row.stepDates.shooting);
  }
}

main().catch(console.error);
