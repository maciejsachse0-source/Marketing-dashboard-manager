import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, desc, inArray } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { db, schema } from '@/lib/db';
import { CampaignNarrativeSection } from '@/components/campaigns/narrative-section';
import { PhasePill } from '@/components/campaigns/phase-pill';
import { PhaseButtons } from '@/components/campaigns/phase-buttons';
import {
  CampaignNameField,
  CampaignGoalField,
  CampaignNotesField,
} from '@/components/campaigns/campaign-inline-fields';
import { ApplyTemplateButton } from '@/components/campaigns/apply-template-button';
import { loadMarketingTemplates } from '@/lib/campaign-templates';
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

  const [entries, posts, productions, marketingTemplates] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: eq(schema.calendarEntries.campaignId, campaignId),
      orderBy: schema.calendarEntries.startsAt,
    }),
    db.query.posts.findMany({
      where: eq(schema.posts.campaignId, campaignId),
      orderBy: desc(schema.posts.publishedAt),
    }),
    db.query.productions.findMany({
      where: eq(schema.productions.campaignId, campaignId),
      orderBy: schema.productions.t0At,
    }),
    loadMarketingTemplates(),
  ]);

  // Bulk-load artists referenced by the productions so the timeline can show
  // names without N+1 round trips. Productions without an artist (solo) get
  // null — the row falls back to the production title.
  const artistIds = Array.from(
    new Set(productions.map((p) => p.artistId).filter((id): id is number => id != null)),
  );
  const artists =
    artistIds.length > 0
      ? await db.query.artists.findMany({
          where: inArray(schema.artists.id, artistIds),
        })
      : [];
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const productionsWithArtist = productions.map((p) => ({
    ...p,
    artist: p.artistId
      ? (() => {
          const a = artistById.get(p.artistId);
          return a ? { id: a.id, name: a.name, handle: a.handle } : null;
        })()
      : null,
  }));

  const totalReach = posts.reduce((sum, p) => sum + (p.reach ?? 0), 0);
  const ersPosts = posts.filter((p) => p.engagementRate !== null);
  const avgER =
    ersPosts.length > 0
      ? ersPosts.reduce((s, p) => s + (p.engagementRate ?? 0), 0) / ersPosts.length
      : null;

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

        {!campaign.templateSlug ? (
          <ApplyTemplateButton
            campaignId={campaign.id}
            templates={marketingTemplates}
          />
        ) : null}

        <CampaignNarrativeSection
          campaignId={campaign.id}
          kickoffAt={campaign.releaseAt}
          initialPeriods={campaign.periods}
          productions={productionsWithArtist}
          entries={entries}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Reach (suma)"
            value={totalReach.toLocaleString('pl-PL')}
            target={targetReach > 0 ? targetReach.toLocaleString('pl-PL') : undefined}
            progress={targetReach > 0 ? Math.min(100, (totalReach / targetReach) * 100) : undefined}
          />
          <KpiCard
            label="Średni ER"
            value={avgER === null ? '—' : `${avgER.toFixed(1)}%`}
            target={targetER > 0 ? `${targetER}%` : undefined}
            progress={targetER > 0 && avgER !== null ? Math.min(100, (avgER / targetER) * 100) : undefined}
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
