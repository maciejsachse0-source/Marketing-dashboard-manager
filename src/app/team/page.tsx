import { count, isNotNull } from 'drizzle-orm';
import { Users, Camera, Briefcase } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { ArtistsShell, type ArtistRow } from '@/components/artists/artists-shell';
import {
  VideographersShell,
  type VideographerRow,
} from '@/components/videographers/videographers-shell';
import { OthersShell, OTHER_TEAM } from '@/components/team/others-shell';
import { db, schema } from '@/lib/db';
import { listOutreachFiles, outreachFilesForArtist } from '@/lib/outreach-files';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  // One groupBy per table beats N+1 SELECTs — replaces the previous
  // per-artist + per-videographer count() round trips.
  const [artists, videographers, allOutreach, artistCollabRows, videoProductionRows] =
    await Promise.all([
      db.query.artists.findMany({ orderBy: schema.artists.name }),
      db.query.videographers.findMany({ orderBy: schema.videographers.name }),
      listOutreachFiles(),
      db
        .select({ id: schema.calendarEntries.artistId, value: count() })
        .from(schema.calendarEntries)
        .where(isNotNull(schema.calendarEntries.artistId))
        .groupBy(schema.calendarEntries.artistId),
      db
        .select({ id: schema.productions.videographerId, value: count() })
        .from(schema.productions)
        .where(isNotNull(schema.productions.videographerId))
        .groupBy(schema.productions.videographerId),
    ]);

  const collabsByArtist = new Map(artistCollabRows.map((r) => [r.id, r.value]));
  const productionsByVideographer = new Map(videoProductionRows.map((r) => [r.id, r.value]));

  const artistRows: ArtistRow[] = artists.map((artist) => ({
    artist,
    collabCount: collabsByArtist.get(artist.id) ?? 0,
    outreachFiles: outreachFilesForArtist(artist.name, allOutreach).map((f) => ({
      filename: f.filename,
      path: f.path,
      modifiedAt: f.modifiedAt.toISOString(),
    })),
  }));

  const videographerRows: VideographerRow[] = videographers.map((videographer) => ({
    videographer,
    productionCount: productionsByVideographer.get(videographer.id) ?? 0,
  }));

  return (
    <PageShell
      title="Zespół"
      eyebrow="ludzie produkcji"
      description="Artyści i kamerzyści — w jednym miejscu kontakty, kolaby, sprzęt."
    >
      <div className="space-y-12">
        <section>
          <SectionHeading icon={Users} title="Artyści" count={artistRows.length} />
          <ArtistsShell rows={artistRows} />
        </section>
        <section>
          <SectionHeading icon={Camera} title="Kamerzyści" count={videographerRows.length} />
          <VideographersShell rows={videographerRows} />
        </section>
        <section>
          <SectionHeading icon={Briefcase} title="Inne" count={OTHER_TEAM.length} />
          <OthersShell />
        </section>
      </div>
    </PageShell>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Users;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
      <span className="pill-label pill-label-sm">{title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
