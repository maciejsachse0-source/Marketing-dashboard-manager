import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, desc } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { db, schema } from '@/lib/db';
import { CampaignTimeline } from '@/components/campaigns/timeline';
import { PhasePill } from '@/components/campaigns/phase-pill';
import { PhaseButtons } from '@/components/campaigns/phase-buttons';
import {
  CampaignNameField,
  CampaignGoalField,
  CampaignNotesField,
} from '@/components/campaigns/campaign-inline-fields';
import { PlatformPills, StatusPill } from '@/components/platforms-pills';
import { TYPE_LABEL } from '@/components/calendar/type-color';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) notFound();

  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) notFound();

  const [entries, packages, posts] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: eq(schema.calendarEntries.campaignId, campaignId),
      orderBy: schema.calendarEntries.startsAt,
    }),
    db.query.packages.findMany({
      where: eq(schema.packages.campaignId, campaignId),
      orderBy: desc(schema.packages.createdAt),
    }),
    db.query.posts.findMany({
      where: eq(schema.posts.campaignId, campaignId),
      orderBy: desc(schema.posts.publishedAt),
    }),
  ]);

  const totalReach = posts.reduce((sum, p) => sum + (p.reach ?? 0), 0);
  const avgER =
    posts.filter((p) => p.engagementRate !== null).reduce((s, p) => s + (p.engagementRate ?? 0), 0) /
    Math.max(1, posts.filter((p) => p.engagementRate !== null).length);

  const kpis = (campaign.kpis ?? {}) as Record<string, string | number>;
  const targetReach = Number(kpis.reach ?? 0);
  const targetER = Number(kpis.engagementRate ?? 0);

  const daysToT0 = Math.round((campaign.releaseAt.getTime() - Date.now()) / 86400000);

  return (
    <PageShell
      title={<CampaignNameField id={campaign.id} name={campaign.name} />}
      description={<CampaignGoalField id={campaign.id} goal={campaign.goal} />}
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-center gap-3 text-sm">
          <PhasePill phase={campaign.phase} />
          <span className="text-muted-foreground">
            T-0: <span className="text-foreground tabular-nums">{campaign.releaseAt.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </span>
          <span className="text-muted-foreground tabular-nums">
            ({daysToT0 >= 0 ? `T-${daysToT0}` : `T+${Math.abs(daysToT0)}`})
          </span>
          <Link href="/campaigns" className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">
            ← wszystkie kampanie
          </Link>
        </header>

        <PhaseButtons id={campaign.id} current={campaign.phase} />

        <CampaignTimeline releaseAt={campaign.releaseAt} entries={entries} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Reach (suma)"
            value={totalReach.toLocaleString('pl-PL')}
            target={targetReach > 0 ? targetReach.toLocaleString('pl-PL') : undefined}
            progress={targetReach > 0 ? Math.min(100, (totalReach / targetReach) * 100) : undefined}
          />
          <KpiCard
            label="Średni ER"
            value={posts.length === 0 ? '—' : `${avgER.toFixed(1)}%`}
            target={targetER > 0 ? `${targetER}%` : undefined}
            progress={targetER > 0 && posts.length > 0 ? Math.min(100, (avgER / targetER) * 100) : undefined}
          />
          <KpiCard label="Posty kampanii" value={`${posts.length}`} target={undefined} />
        </div>

        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Notatki
          </h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <CampaignNotesField id={campaign.id} notes={campaign.notes} />
          </div>
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Wpisy kalendarza ({entries.length})
          </h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak wpisów. Wygeneruj przez campaign-strategist.</p>
          ) : (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground w-20 shrink-0">
                    {TYPE_LABEL[e.type]}
                  </span>
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {e.startsAt.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Pakiety ({packages.length})
          </h2>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak pakietów powiązanych z tą kampanią.</p>
          ) : (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {packages.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate font-medium">{p.title}</span>
                  <PlatformPills platforms={p.platforms} />
                  <StatusPill status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Posty ({posts.length})
          </h2>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak postów. Wgraj CSV w analityce.</p>
          ) : (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {posts.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    [{p.platform}] {p.publishedAt.toLocaleDateString('pl-PL', { dateStyle: 'short' })}
                  </span>
                  <span className="text-xs tabular-nums">
                    {p.reach ? `reach ${p.reach.toLocaleString('pl-PL')}` : '—'}
                    {p.engagementRate ? ` · ER ${p.engagementRate}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function KpiCard({
  label,
  value,
  target,
  progress,
}: {
  label: string;
  value: string;
  target?: string;
  progress?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {target ? (
        <div className="text-xs text-muted-foreground mt-1">cel: {target}</div>
      ) : null}
      {progress !== undefined ? (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-foreground/70" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}
