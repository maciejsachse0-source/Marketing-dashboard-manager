import { eq, count } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { db, schema } from '@/lib/db';
import { VideographersShell, type VideographerRow } from '@/components/videographers/videographers-shell';

export const dynamic = 'force-dynamic';

export default async function VideographersPage() {
  const videographers = await db.query.videographers.findMany({ orderBy: schema.videographers.name });

  const rows: VideographerRow[] = await Promise.all(
    videographers.map(async (videographer) => {
      const productions = await db
        .select({ value: count() })
        .from(schema.productions)
        .where(eq(schema.productions.videographerId, videographer.id));
      return {
        videographer,
        productionCount: productions[0]?.value ?? 0,
      };
    }),
  );

  return (
    <PageShell
      title="Kamerzyści"
      description="Baza kamerzystów na nagrania kolab — sprzęt, stawki, dostępność."
    >
      <VideographersShell rows={rows} />
    </PageShell>
  );
}
