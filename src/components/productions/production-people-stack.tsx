import type { ReactNode } from 'react';
import {
  PersonAvatar,
  SoloAvatar,
  OrphanArtistAvatar,
} from '@/components/productions/artist-avatar';

/**
 * Compact "who's on this production" cluster — replaces the textual
 * `ProductionTypeBadge` ("z artystą" / "solo") + "kam: <name>" string in the
 * gantt meta column. Each face is a small avatar with a styled hover card
 * showing the person's name + production type context (solo / z kamerzystą).
 *
 * Layout: artist (or solo/orphan placeholder) on the left, videographer to
 * the right — same reading order as the row's narrative ("artist works with
 * videographer"). Stays purely informational; clicking opens nothing.
 */
export function ProductionPeopleStack({
  type,
  artistName,
  artistHandle,
  videographerName,
}: {
  type: 'with-artist' | 'solo';
  artistName: string | null;
  artistHandle: string | null;
  videographerName: string | null;
}) {
  const hasArtist = type === 'with-artist' && !!artistName;
  const orphanArtist = type === 'with-artist' && !artistName;
  const crewSuffix = videographerName
    ? `z kamerzystą ${videographerName}`
    : 'solo';

  return (
    <div className="flex items-center gap-1.5">
      {hasArtist ? (
        <PeopleAvatarTooltip
          title={artistName!}
          subtitle={artistHandle ?? undefined}
          meta={crewSuffix}
        >
          <PersonAvatar
            name={artistName!}
            seed={artistHandle ?? artistName}
            size="sm"
            kind="artist"
          />
        </PeopleAvatarTooltip>
      ) : orphanArtist ? (
        <PeopleAvatarTooltip
          title="Brak artysty"
          meta={`Produkcja z artystą — ${crewSuffix}. Przypisz artystę w produkcji.`}
        >
          <OrphanArtistAvatar size="sm" />
        </PeopleAvatarTooltip>
      ) : (
        <PeopleAvatarTooltip
          title="Produkcja solo"
          meta={
            videographerName
              ? `Bez artysty · z kamerzystą ${videographerName}`
              : 'Bez artysty · bez kamerzysty'
          }
        >
          <SoloAvatar size="sm" />
        </PeopleAvatarTooltip>
      )}

      {videographerName ? (
        <PeopleAvatarTooltip
          title={videographerName}
          subtitle="Kamerzysta"
        >
          <PersonAvatar
            name={videographerName}
            size="sm"
            kind="videographer"
            showBadge={false}
          />
        </PeopleAvatarTooltip>
      ) : null}
    </div>
  );
}

function PeopleAvatarTooltip({
  title,
  subtitle,
  meta,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <span className="group/people relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="opacity-0 group-hover/people:opacity-100 group-focus-within/people:opacity-100 transition-opacity duration-150 pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[16rem] rounded-md border border-border bg-popover text-popover-foreground shadow-lg px-2.5 py-1.5"
      >
        <span className="block text-[12px] font-semibold leading-tight text-foreground">
          {title}
        </span>
        {subtitle ? (
          <span className="block text-[10.5px] tabular-nums text-muted-foreground leading-tight mt-0.5">
            {subtitle}
          </span>
        ) : null}
        {meta ? (
          <span className="block text-[10.5px] text-muted-foreground leading-snug mt-1 pt-1 border-t border-border/70">
            {meta}
          </span>
        ) : null}
        <span
          aria-hidden
          className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-popover border-r border-b border-border"
        />
      </span>
    </span>
  );
}
