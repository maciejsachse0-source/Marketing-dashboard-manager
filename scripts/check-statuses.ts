import { db } from '../src/lib/db';

async function main() {
  const prods = await db.query.productions.findMany();
  console.log('productions:', prods.length);
  const statusCounts: Record<string, number> = {};
  for (const p of prods) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }
  console.log('statuses:', JSON.stringify(statusCounts, null, 2));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
