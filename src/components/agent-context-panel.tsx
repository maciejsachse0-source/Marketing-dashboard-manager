import Link from 'next/link';
import {
  getUpcomingCalendar,
  getRecentPosts,
  getAllArtists,
  getActiveCampaigns,
} from '@/lib/context';
import type { AgentSidePanel } from '@/lib/agents/types';
import { TYPE_LABEL } from './calendar/type-color';

export async function AgentContextPanel({ kind }: { kind: AgentSidePanel }) {
  switch (kind) {
    case 'calendar-14':
      return <CalendarPanel />;
    case 'recent-posts':
      return <RecentPostsPanel />;
    case 'artists-list':
      return <ArtistsPanel />;
    case 'active-campaigns':
      return <CampaignsPanel />;
    case 'trend-bookmarks':
      return (
        <PlaceholderPanel
          title="Bookmarki trendów"
          hint="Zapisane trendy — będą tu w Fazie 2."
        />
      );
  }
}

function PanelShell({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {count !== undefined ? (
          <span className="text-xs text-muted-foreground">{count}</span>
        ) : null}
      </div>
      <div className="p-3 max-h-[60vh] overflow-y-auto">{children}</div>
    </div>
  );
}

function PlaceholderPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <PanelShell title={title}>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </PanelShell>
  );
}

async function CalendarPanel() {
  const upcoming = await getUpcomingCalendar(14);
  return (
    <PanelShell title="Kalendarz · 14 dni" count={upcoming.length}>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Pusto. Dodaj wpisy w{' '}
          <Link href="/calendar" className="underline">
            kalendarzu
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map((e) => (
            <li key={e.id} className="text-xs flex items-start gap-2">
              <span className="text-muted-foreground shrink-0 w-12 tabular-nums">
                {e.startsAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="shrink-0 text-muted-foreground/70">
                {String(e.startsAt.getHours()).padStart(2, '0')}:
                {String(e.startsAt.getMinutes()).padStart(2, '0')}
              </span>
              <span className="flex-1 truncate">
                <span className="text-muted-foreground/60">[{TYPE_LABEL[e.type]}]</span>{' '}
                {e.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

async function RecentPostsPanel() {
  const posts = await getRecentPosts(8);
  return (
    <PanelShell title="Ostatnie posty" count={posts.length}>
      {posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Brak postów. Wgraj CSV w{' '}
          <Link href="/analytics" className="underline">
            analityce
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1.5">
          {posts.map((p) => (
            <li key={p.id} className="text-xs">
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-muted-foreground">
                [{p.platform}] {p.publishedAt.toLocaleDateString('pl-PL')}
                {p.reach ? ` · reach ${p.reach.toLocaleString('pl-PL')}` : ''}
                {p.engagementRate ? ` · ER ${p.engagementRate}%` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

async function ArtistsPanel() {
  const artists = await getAllArtists();
  return (
    <PanelShell title="Artyści" count={artists.length}>
      {artists.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Brak artystów. Dodaj w{' '}
          <Link href="/artists" className="underline">
            bazie
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1.5">
          {artists.map((a) => (
            <li key={a.id} className="text-xs">
              <div className="font-medium">
                {a.name} <span className="text-muted-foreground/70">#{a.id}</span>
              </div>
              <div className="text-muted-foreground truncate">
                {a.handle ?? '—'}
                {a.lastContactAt
                  ? ` · ostatnio: ${a.lastContactAt.toLocaleDateString('pl-PL')}`
                  : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

async function CampaignsPanel() {
  const campaigns = await getActiveCampaigns();
  return (
    <PanelShell title="Aktywne kampanie" count={campaigns.length}>
      {campaigns.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak kampanii.</p>
      ) : (
        <ul className="space-y-1.5">
          {campaigns.map((c) => (
            <li key={c.id} className="text-xs">
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-muted-foreground">
                T-0 {c.releaseAt.toLocaleDateString('pl-PL')} · faza: {c.phase}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

