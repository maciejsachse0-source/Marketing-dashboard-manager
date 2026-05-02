import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { listProductions } from '@/server/actions/productions';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { NewProductionButton } from '@/components/productions/new-production-button';
import { ProductionsList } from '@/components/productions/productions-list';
import { loadTemplates } from '@/lib/production-templates';

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

  const filtered = productions.filter((p) => {
    if (sp.type && p.type !== sp.type) return false;
    if (sp.status === 'cancelled') return !!p.cancelledAt;
    if (sp.status === 'done')
      return (
        !p.cancelledAt &&
        (p.steps ?? []).length > 0 &&
        (p.steps ?? []).every((s) => !!s.doneAt)
      );
    if (sp.status === 'in-progress')
      return (
        !p.cancelledAt &&
        !((p.steps ?? []).length > 0 && (p.steps ?? []).every((s) => !!s.doneAt))
      );
    return true;
  });

  const artistOptions = artists.map((a) => ({ id: a.id, name: a.name, handle: a.handle }));
  const videographerOptions = videographers.map((v) => ({
    id: v.id,
    name: v.name,
    hourlyRate: v.hourlyRate,
  }));

  const typeFilter =
    sp.type === 'with-artist' || sp.type === 'solo' ? sp.type : undefined;

  return (
    <PageShell
      title="Lista produkcji"
      eyebrow="łańcuch produkcji"
      description="Każde wideo to produkcja — od pomysłu, przez nagranie, po analizę. Pogrupowane: kogo dotyczy."
      actions={
        <NewProductionButton
          artists={artistOptions}
          videographers={videographerOptions}
          templates={loadTemplates()}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <FilterLink href="/productions/list" active={!sp.type}>
          Wszystkie ({productions.length})
        </FilterLink>
        <FilterLink
          href="/productions/list?type=with-artist"
          active={sp.type === 'with-artist'}
        >
          Z artystą ({productions.filter((p) => p.type === 'with-artist').length})
        </FilterLink>
        <FilterLink href="/productions/list?type=solo" active={sp.type === 'solo'}>
          Solo ({productions.filter((p) => p.type === 'solo').length})
        </FilterLink>
      </div>

      <ProductionsList
        productions={filtered}
        artists={artists}
        videographers={videographers}
        typeFilter={typeFilter}
      />
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
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}
