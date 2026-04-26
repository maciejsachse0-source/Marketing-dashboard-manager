import { eq, count } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { ArtistsShell, type ArtistRow } from '@/components/artists/artists-shell';
import { db, schema } from '@/lib/db';
import { listOutreachFiles, outreachFilesForArtist } from '@/lib/outreach-files';

export const dynamic = 'force-dynamic';

export default async function ArtistsPage() {
  const artists = await db.query.artists.findMany({ orderBy: schema.artists.name });
  const allOutreach = listOutreachFiles();

  const rows: ArtistRow[] = await Promise.all(
    artists.map(async (artist) => {
      const collabs = await db
        .select({ value: count() })
        .from(schema.calendarEntries)
        .where(eq(schema.calendarEntries.artistId, artist.id));
      return {
        artist,
        collabCount: collabs[0]?.value ?? 0,
        outreachFiles: outreachFilesForArtist(artist.name, allOutreach).map((f) => ({
          filename: f.filename,
          path: f.path,
          modifiedAt: f.modifiedAt.toISOString(),
        })),
      };
    }),
  );

  return (
    <PageShell title="Artyści" description="Baza kolab + historia kontaktów.">
      <ArtistsShell rows={rows} />
    </PageShell>
  );
}
