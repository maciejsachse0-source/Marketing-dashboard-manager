import {
  PersonAvatar,
  SoloAvatar,
  OrphanArtistAvatar,
} from '@/components/productions/artist-avatar';

/**
 * Compact "who's on this production" cluster — replaces the textual
 * `ProductionTypeBadge` ("z artystą" / "solo") + "kam: <name>" string in the
 * gantt meta column. Each face is a small avatar with a `title` attribute, so
 * hover reveals the name without taking up horizontal space.
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

  return (
    <div className="flex items-center gap-1.5">
      {hasArtist ? (
        <span title={`Artysta: ${artistName}${artistHandle ? ` (${artistHandle})` : ''}`}>
          <PersonAvatar
            name={artistName!}
            seed={artistHandle ?? artistName}
            size="sm"
            kind="artist"
          />
        </span>
      ) : orphanArtist ? (
        <span title="Z artystą — brak przypisanego artysty, uzupełnij w produkcji">
          <OrphanArtistAvatar size="sm" />
        </span>
      ) : (
        <span title="Produkcja solo — bez artysty">
          <SoloAvatar size="sm" />
        </span>
      )}

      {videographerName ? (
        <span title={`Kamerzysta: ${videographerName}`}>
          <PersonAvatar
            name={videographerName}
            size="sm"
            kind="videographer"
            showBadge={false}
          />
        </span>
      ) : null}
    </div>
  );
}
