import Link from 'next/link';
import { and, gte, eq, desc, count } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { AGENT_LIST } from '@/lib/agents';
import { db, schema } from '@/lib/db';
import { getUpcomingCalendar } from '@/lib/context';
import { CsvDropzone } from '@/components/analytics/csv-dropzone';
import { PlatformPills, PlatformPill, StatusPill } from '@/components/platforms-pills';
import { TYPE_LABEL } from '@/components/calendar/type-color';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [upcoming, weekPosts, monthPosts, draftCount, topPosts, readyPackages] = await Promise.all([
    getUpcomingCalendar(7),
    db.query.posts.findMany({ where: gte(schema.posts.publishedAt, sevenDaysAgo) }),
    db.query.posts.findMany({ where: gte(schema.posts.publishedAt, thirtyDaysAgo) }),
    db
      .select({ value: count() })
      .from(schema.packages)
      .where(eq(schema.packages.status, 'draft')),
    db.query.posts.findMany({
      where: gte(schema.posts.publishedAt, sevenDaysAgo),
      orderBy: desc(schema.posts.reach),
      limit: 4,
    }),
    db.query.packages.findMany({
      where: eq(schema.packages.status, 'ready'),
      orderBy: desc(schema.packages.createdAt),
      limit: 6,
    }),
  ]);

  const ersInMonth = monthPosts.filter((p) => p.engagementRate !== null);
  const avgER = ersInMonth.length
    ? ersInMonth.reduce((s, p) => s + (p.engagementRate ?? 0), 0) / ersInMonth.length
    : null;
  const newFollowers = weekPosts.reduce((s, p) => s + (p.followersGained ?? 0), 0);

  const today = now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  const isoWeek = (() => {
    const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  })();

  return (
    <PageShell title="Marketing Crew" description={`${today} · tydzień ${isoWeek}`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <MetricCard
          label="Posty w tym tyg."
          value={`${weekPosts.length}/7`}
          hint={weekPosts.length === 0 ? 'wgraj CSV lub dodaj manualnie' : undefined}
        />
        <MetricCard
          label="Średni ER (30d)"
          value={avgER !== null ? `${avgER.toFixed(1)}%` : '—'}
          hint={
            avgER === null
              ? 'brak metryk'
              : avgER < 2
                ? 'słabo'
                : avgER < 5
                  ? 'ok'
                  : avgER < 10
                    ? 'dobrze'
                    : 'bardzo dobrze'
          }
        />
        <MetricCard
          label="Nowi followersi (7d)"
          value={newFollowers > 0 ? `+${newFollowers.toLocaleString('pl-PL')}` : '—'}
        />
        <MetricCard
          label="Do akceptacji"
          value={`${draftCount[0]?.value ?? 0}`}
          hint="pakiety w drafcie"
        />
      </section>

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Agenci</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AGENT_LIST.map((agent) => (
            <Link
              key={agent.slug}
              href={`/agents/${agent.slug}`}
              className="rounded-lg border border-border bg-card p-4 hover:border-foreground/30 transition"
            >
              <div className="font-medium text-sm">{agent.name}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-6">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Tydzień produkcji
          </h2>
          {upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Pusto. Otwórz{' '}
              <Link href="/agents/schedule-manager" className="underline">
                Schedule Managera
              </Link>{' '}
              albo dodaj wpis ręcznie w{' '}
              <Link href="/calendar" className="underline">
                kalendarzu
              </Link>
              .
            </div>
          ) : (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {upcoming.slice(0, 7).map((e) => (
                <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground w-20 shrink-0">
                    {TYPE_LABEL[e.type]}
                  </span>
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {e.startsAt.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Top posty (7 dni)
          </h2>
          {topPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Brak postów. Wgraj CSV w{' '}
              <Link href="/analytics" className="underline">
                analityce
              </Link>
              .
            </div>
          ) : (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {topPosts.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <PlatformPill platform={p.platform} />
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {p.reach ? p.reach.toLocaleString('pl-PL') : '—'}
                    {p.engagementRate ? ` · ${p.engagementRate}%` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
              Wgraj CSV
            </h2>
            <Link href="/analytics" className="text-xs text-muted-foreground hover:text-foreground underline">
              cała analityka →
            </Link>
          </div>
          <CsvDropzone />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
              Pakiety do publikacji
            </h2>
            <Link href="/packages" className="text-xs text-muted-foreground hover:text-foreground underline">
              wszystkie →
            </Link>
          </div>
          {readyPackages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Brak pakietów ze statusem <code>ready</code>.
            </div>
          ) : (
            <ul className="rounded-lg border border-border divide-y divide-border">
              {readyPackages.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                  <Link href={`/packages`} className="flex-1 truncate font-medium">
                    {p.title}
                  </Link>
                  <PlatformPills platforms={p.platforms} />
                  <StatusPill status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  );
}
