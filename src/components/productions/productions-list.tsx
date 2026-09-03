import Link from 'next/link';
import { Film } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PlatformPills } from '@/components/platforms-pills';
import { PersonAvatar } from '@/components/productions/artist-avatar';
import { ProductionStepTracker } from '@/components/productions/production-step-tracker';
import type { Artist, Production, Videographer } from '../../../drizzle/schema';

/** Produkcje w kubełkach: po artyście, po operatorze, reszta bez przypisania. */
function groupByPerson(productions: Production[]) {
  const byArtist = new Map<number, Production[]>();
  const byVideographer = new Map<number, Production[]>();
  const orphanSolo: Production[] = [];

  const push = (map: Map<number, Production[]>, key: number, p: Production) => {
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  };

  for (const p of productions) {
    if (p.type === 'with-artist' && p.artistId != null) push(byArtist, p.artistId, p);
    else if (p.videographerId != null) push(byVideographer, p.videographerId, p);
    else orphanSolo.push(p);
  }
  return { byArtist, byVideographer, orphanSolo };
}

/** Które sekcje listy pokazujemy przy danym filtrze typu. */
function visibleSections(typeFilter?: 'with-artist' | 'solo') {
  return {
    artists: !typeFilter || typeFilter === 'with-artist',
    solo: !typeFilter || typeFilter === 'solo',
  };
}

export function ProductionsList({
  productions,
  artists,
  videographers,
  typeFilter,
  emptyDescription,
}: {
  productions: Production[];
  artists: Artist[];
  videographers: Videographer[];
  typeFilter?: 'with-artist' | 'solo';
  emptyDescription?: string;
}) {
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const videographerById = new Map(videographers.map((v) => [v.id, v]));

  const { byArtist, byVideographer, orphanSolo } = groupByPerson(productions);

  const artistGroups = [...byArtist.entries()]
    .map(([id, prods]) => ({ person: artistById.get(id), prods, kind: 'artist' as const }))
    .filter(
      (g): g is { person: Artist; prods: Production[]; kind: 'artist' } => Boolean(g.person),
    )
    .sort((a, b) => (b.prods[0]?.t0At.getTime() ?? 0) - (a.prods[0]?.t0At.getTime() ?? 0));

  const videographerGroups = [...byVideographer.entries()]
    .map(([id, prods]) => ({ person: videographerById.get(id), prods, kind: 'videographer' as const }))
    .filter(
      (g): g is { person: Videographer; prods: Production[]; kind: 'videographer' } =>
        Boolean(g.person),
    )
    .sort((a, b) => (b.prods[0]?.t0At.getTime() ?? 0) - (a.prods[0]?.t0At.getTime() ?? 0));

  const { artists: showArtistSection, solo: showSoloSection } = visibleSections(typeFilter);

  if (productions.length === 0) {
    return (
      <EmptyState
        icon={Film}
        title="Brak produkcji"
        description={
          emptyDescription ??
          'Kliknij „+ Nowa produkcja" lub użyj skrótu p - utwórz produkcję od zera, wpisy kalendarza dodaj ręcznie.'
        }
      />
    );
  }

  return (
    <div className="space-y-12">
      {showArtistSection && artistGroups.length > 0 ? (
        <section>
          <ListSectionHeading
            title="Z artystą"
            count={artistGroups.reduce((s, g) => s + g.prods.length, 0)}
          />
          <div className="space-y-10">
            {artistGroups.map((g) => (
              <PersonGroup
                key={`a-${g.person.id}`}
                person={g.person}
                productions={g.prods}
                kind="artist"
              />
            ))}
          </div>
        </section>
      ) : null}

      {showSoloSection && (videographerGroups.length > 0 || orphanSolo.length > 0) ? (
        <section>
          <ListSectionHeading
            title="Solo, po kamerzyście"
            count={
              videographerGroups.reduce((s, g) => s + g.prods.length, 0) + orphanSolo.length
            }
          />
          <div className="space-y-10">
            {videographerGroups.map((g) => (
              <PersonGroup
                key={`v-${g.person.id}`}
                person={g.person}
                productions={g.prods}
                kind="videographer"
              />
            ))}
            {orphanSolo.length > 0 ? (
              <div>
                <header className="flex items-center gap-3 mb-3 pl-1">
                  <div className="w-10 h-10 rounded-full bg-muted grid place-items-center text-muted-foreground ring-2 ring-background">
                    <Film className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="font-semibold text-[0.95rem] tracking-tight leading-tight">
                      Bez kamerzysty
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      przypisz w produkcji →
                    </div>
                  </div>
                  <span className="ml-auto label-micro text-muted-foreground tabular-nums">
                    {orphanSolo.length}{' '}
                    {orphanSolo.length === 1 ? 'produkcja' : 'produkcji'}
                  </span>
                </header>
                <div className="space-y-3">
                  {orphanSolo.map((p) => (
                    <ProductionCard key={p.id} production={p} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ListSectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="pill-label pill-label-sm">{title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function PersonGroup({
  person,
  productions,
  kind,
}: {
  person: Artist | Videographer;
  productions: Production[];
  kind: 'artist' | 'videographer';
}) {
  const handle = kind === 'artist' ? (person as Artist).handle : null;
  const subtitle =
    kind === 'artist'
      ? handle
      : // F7-32: podpis kamerzysty z własnych kolumn, `contact` tylko awaryjnie.
        ((person as Videographer).handle ??
          (person as Videographer).email ??
          (person as Videographer).contact ??
          'kamerzysta');

  return (
    <div>
      <header className="flex items-center gap-3 mb-3 pl-1">
        <PersonAvatar
          name={person.name}
          seed={handle ?? person.name}
          size="md"
          kind={kind}
        />
        <div className="min-w-0">
          <div className="font-semibold text-[0.95rem] tracking-tight leading-tight">
            {person.name}
          </div>
          {subtitle ? (
            <div className="text-xs text-muted-foreground leading-tight truncate max-w-[18rem]">
              {subtitle}
            </div>
          ) : null}
        </div>
        <span className="ml-auto label-micro text-muted-foreground tabular-nums">
          {productions.length} {productions.length === 1 ? 'produkcja' : 'produkcji'}
        </span>
      </header>
      <div className="space-y-3">
        {productions.map((p) => (
          <ProductionCard key={p.id} production={p} />
        ))}
      </div>
    </div>
  );
}

/**
 * F7-24: tytuł produkcji jest na KAŻDEJ karcie, nie tylko w grupie „Solo, po
 * kamerzyście". Bez niego dwie produkcje tego samego artysty były na liście
 * nierozróżnialne — widać było tylko paski kroków.
 */
function ProductionCard({ production: p }: { production: Production }) {
  return (
    <Link
      href={`/productions/${p.id}`}
      className="card-editorial p-5 block ui-transition hover:-translate-y-px"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-muted grid place-items-center text-muted-foreground shrink-0 ring-2 ring-background">
          <Film className="w-3.5 h-3.5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[0.95rem] tracking-tight truncate block">
            {p.title}
          </span>
        </div>
        {p.platforms?.length ? (
          <div className="shrink-0">
            <PlatformPills platforms={p.platforms} />
          </div>
        ) : null}
      </div>

      <ProductionStepTracker steps={p.steps ?? []} cancelled={!!p.cancelledAt} />
    </Link>
  );
}
