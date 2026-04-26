import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { db, schema } from '@/lib/db';
import { PhasePill } from '@/components/campaigns/phase-pill';

export const dynamic = 'force-dynamic';

export default async function CampaignsListPage() {
  const campaigns = await db.query.campaigns.findMany({
    orderBy: desc(schema.campaigns.releaseAt),
  });

  return (
    <PageShell title="Kampanie" description="Aktywne i zakończone kampanie premier.">
      <div className="flex justify-end mb-3">
        <Link
          href="/agents/campaign-strategist"
          className="text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
        >
          + Nowa kampania (przez campaign-strategist)
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Brak kampanii.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {campaigns.map((c) => {
            const daysToT0 = Math.round((c.releaseAt.getTime() - Date.now()) / 86400000);
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium">{c.name}</div>
                  <PhasePill phase={c.phase} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">{c.goal}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">
                    T-0: {c.releaseAt.toLocaleDateString('pl-PL', { dateStyle: 'medium' })}
                  </span>
                  <span
                    className={`tabular-nums ${
                      daysToT0 < 0
                        ? 'text-muted-foreground'
                        : daysToT0 < 7
                          ? 'text-amber-400'
                          : 'text-foreground'
                    }`}
                  >
                    {daysToT0 >= 0 ? `T-${daysToT0}` : `T+${Math.abs(daysToT0)}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
