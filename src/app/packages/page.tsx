import { desc } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { PackagesShell } from '@/components/packages/packages-shell';
import { db, schema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PackagesPage() {
  const packages = await db.query.packages.findMany({
    orderBy: desc(schema.packages.createdAt),
  });
  return (
    <PageShell
      title="Pakiety publikacyjne"
      description="Gotowe do uploadu na socjale. Klik w kartę → captiony i hashtagi do skopiowania."
    >
      <PackagesShell packages={packages} />
    </PageShell>
  );
}
