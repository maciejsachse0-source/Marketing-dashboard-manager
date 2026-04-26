import Link from 'next/link';
import { gte, eq, desc, count } from 'drizzle-orm';
import {
  CalendarDays,
  TrendingUp,
  UserPlus,
  Inbox,
  Upload,
  PackageOpen,
  Sparkles,
  Activity,
  Megaphone,
  Users,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { loadAgents } from '@/lib/agents';
import { runAgentWidget } from '@/lib/agents/widget';
import { db, schema } from '@/lib/db';
import { getUpcomingCalendar } from '@/lib/context';
import { getRecentActivity, type ActivityEvent } from '@/lib/activity';
import { timeAgo } from '@/lib/time-ago';
import { CsvDropzone } from '@/components/analytics/csv-dropzone';
import { PlatformPills, PlatformPill, StatusPill } from '@/components/platforms-pills';
import { TYPE_LABEL } from '@/components/calendar/type-color';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [upcoming, weekPosts, monthPosts, draftCount, topPosts, readyPackages, activity] =
    await Promise.all([
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
      getRecentActivity(8),
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
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <MetricCard
          icon={CalendarDays}
          label="Posty w tym tyg."
          value={`${weekPosts.length}/7`}
          hint={weekPosts.length === 0 ? 'wgraj CSV' : undefined}
        />
        <MetricCard
          icon={TrendingUp}
          label="Średni ER · 30d"
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
          tone={
            avgER !== null && avgER >= 5
              ? 'good'
              : avgER !== null && avgER >= 2
                ? 'neutral'
                : 'low'
          }
        />
        <MetricCard
          icon={UserPlus}
          label="Nowi followersi · 7d"
          value={newFollowers > 0 ? `+${newFollowers.toLocaleString('pl-PL')}` : '—'}
          tone={newFollowers > 0 ? 'good' : 'neutral'}
        />
        <MetricCard
          icon={Inbox}
          label="Do akceptacji"
          value={`${draftCount[0]?.value ?? 0}`}
          hint="pakiety w drafcie"
        />
      </section>

      <section className="mb-10">
        <SectionHeader icon={Sparkles} title="Agenci" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loadAgents().map((agent) => {
            const hint = agent.dashboardWidget ? runAgentWidget(agent.dashboardWidget) : null;
            return (
              <Link
                key={agent.slug}
                href={`/agents/${agent.slug}`}
                className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-card/90 transition relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="font-medium text-sm group-hover:text-foreground transition">{agent.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</div>
                {hint ? (
                  <div className="text-[11px] text-primary/80 mt-2 font-medium tabular-nums">{hint}</div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-8">
        <div>
          <SectionHeader icon={CalendarDays} title="Tydzień produkcji" />
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Pusto na ten tydzień"
              description={
                <>
                  Otwórz{' '}
                  <Link href="/agents/schedule-manager" className="underline hover:text-foreground">
                    schedule-managera
                  </Link>{' '}
                  albo dodaj wpis ręcznie w{' '}
                  <Link href="/calendar" className="underline hover:text-foreground">
                    kalendarzu
                  </Link>
                  .
                </>
              }
            />
          ) : (
            <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {upcoming.slice(0, 7).map((e) => (
                <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-muted/30 transition">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0 font-medium">
                    {TYPE_LABEL[e.type]}
                  </span>
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {e.startsAt.toLocaleString('pl-PL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionHeader icon={TrendingUp} title="Top posty · 7 dni" />
          {topPosts.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Brak danych"
              description={
                <>
                  Wgraj CSV w{' '}
                  <Link href="/analytics" className="underline hover:text-foreground">
                    analityce
                  </Link>
                  .
                </>
              }
            />
          ) : (
            <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {topPosts.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-muted/30 transition">
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

      <section className="mb-8">
        <SectionHeader icon={Activity} title="Ostatnie zmiany" />
        {activity.length === 0 ? (
          <EmptyState icon={Activity} title="Brak aktywności" description="Po pierwszych akcjach pojawią się tu wpisy." />
        ) : (
          <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {activity.map((event, idx) => (
              <ActivityRow key={`${event.kind}-${event.title}-${idx}`} event={event} />
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={Upload} title="Wgraj CSV" />
            <Link
              href="/analytics"
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              cała analityka →
            </Link>
          </div>
          <CsvDropzone />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={PackageOpen} title="Pakiety do publikacji" />
            <Link
              href="/packages"
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              wszystkie →
            </Link>
          </div>
          {readyPackages.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="Brak pakietów ready"
              description={
                <>
                  Wygeneruj przez{' '}
                  <Link href="/agents/social-publisher" className="underline hover:text-foreground">
                    social-publishera
                  </Link>
                  .
                </>
              }
            />
          ) : (
            <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {readyPackages.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-sm hover:bg-muted/30 transition">
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

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'neutral' | 'low';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'low'
        ? 'text-amber-400'
        : 'text-muted-foreground';
  return (
    <div className="rounded-xl border border-border bg-card p-4 relative overflow-hidden hover:border-primary/20 transition">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground/70" strokeWidth={1.5} />
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint ? <div className={`text-[11px] mt-0.5 ${toneClass}`}>{hint}</div> : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
      {title}
    </h2>
  );
}

const ACTIVITY_ICON: Record<ActivityEvent['kind'], LucideIcon> = {
  'calendar-entry': CalendarDays,
  post: TrendingUp,
  package: PackageOpen,
  artist: Users,
  campaign: Megaphone,
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  const Icon = ACTIVITY_ICON[event.kind] ?? FileText;
  return (
    <li>
      <Link
        href={event.href}
        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30 transition"
      >
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          <div className="truncate">{event.title}</div>
          <div className="text-xs text-muted-foreground">{event.subtitle}</div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {timeAgo(event.at)}
        </span>
      </Link>
    </li>
  );
}
