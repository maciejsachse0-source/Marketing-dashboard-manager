import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { listProductions } from '@/server/actions/productions';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { listProductionTemplates } from '@/lib/templates';
import { EmptyState } from '@/components/empty-state';
import { ProductionStatusPill, ProductionTypeBadge } from '@/components/productions/status-pill';
import { NewProductionButton } from '@/components/productions/new-production-button';
import { PlatformPills } from '@/components/platforms-pills';
import { Film } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProductionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const [productions, artists, videographers] = await Promise.all([
    listProductions(),
    listArtists(),
    listVideographers(),
  ]);
  const templates = listProductionTemplates();

  const filtered = productions.filter((p) => {
    if (sp.type && p.type !== sp.type) return false;
    if (sp.status && p.status !== sp.status) return false;
    return true;
  });

  const artistOptions = artists.map((a) => ({ id: a.id, name: a.name, handle: a.handle }));
  const videographerOptions = videographers.map((v) => ({
    id: v.id,
    name: v.name,
    hourlyRate: v.hourlyRate,
  }));

  return (
    <PageShell
      title="Produkcje"
      description="Każde wideo to produkcja — łańcuch kroków od pomysłu do analizy."
      actions={
        <NewProductionButton
          templates={templates}
          artists={artistOptions}
          videographers={videographerOptions}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterLink href="/productions" active={!sp.type}>
          Wszystkie ({productions.length})
        </FilterLink>
        <FilterLink href="/productions?type=with-artist" active={sp.type === 'with-artist'}>
          Z artystą ({productions.filter((p) => p.type === 'with-artist').length})
        </FilterLink>
        <FilterLink href="/productions?type=solo" active={sp.type === 'solo'}>
          Solo ({productions.filter((p) => p.type === 'solo').length})
        </FilterLink>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Brak produkcji"
          description={'Kliknij „+ Nowa produkcja” lub użyj skrótu p — wybierz template i T-0, wpisy kalendarza wygenerują się same.'}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const days = Math.round((p.t0At.getTime() - Date.now()) / 86400000);
            return (
              <li key={p.id}>
                <Link
                  href={`/productions/${p.id}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{p.title}</span>
                        <ProductionTypeBadge type={p.type} />
                        <ProductionStatusPill status={p.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        T-0: {p.t0At.toLocaleDateString('pl-PL', { dateStyle: 'medium' })}
                        {' · '}
                        {days >= 0 ? `T-${days}` : `T+${Math.abs(days)}`}
                        {p.templateSlug !== 'manual' ? ` · template: ${p.templateSlug}` : ''}
                      </div>
                    </div>
                    {p.platforms?.length ? <PlatformPills platforms={p.platforms} /> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded border text-xs transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}
