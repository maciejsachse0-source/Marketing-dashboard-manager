import { count, isNotNull } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { ArtistsShell, type ArtistRow } from '@/components/artists/artists-shell';
import { db, schema } from '@/lib/db';
import { listOutreachFiles, outreachFilesForArtist } from '@/lib/outreach-files';

export const dynamic = 'force-dynamic';

export default async function ArtistsPage() {
  // One groupBy beats N+1 SELECTs — was issuing one count() per artist.
  const [artists, allOutreach, collabRows] = await Promise.all([
    db.query.artists.findMany({ orderBy: schema.artists.name }),
    listOutreachFiles(),
    db
      .select({ id: schema.calendarEntries.artistId, value: count() })
      .from(schema.calendarEntries)
      .where(isNotNull(schema.calendarEntries.artistId))
      .groupBy(schema.calendarEntries.artistId),
  ]);

  const collabsByArtist = new Map(collabRows.map((r) => [r.id, r.value]));

  const rows: ArtistRow[] = artists.map((artist) => ({
    artist,
    collabCount: collabsByArtist.get(artist.id) ?? 0,
    outreachFiles: outreachFilesForArtist(artist.name, allOutreach).map((f) => ({
      filename: f.filename,
      path: f.path,
      modifiedAt: f.modifiedAt.toISOString(),
    })),
  }));

  return (
    <PageShell title="Artyści" description="Baza kolab + historia kontaktów.">
      <ArtistsShell rows={rows} />
    </PageShell>
  );
}
