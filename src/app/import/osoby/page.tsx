import { PageShell } from '@/components/page-shell';
import { ImportShell } from '@/components/import/import-shell';
import { db, schema } from '@/lib/db';
import type { ExistingPerson } from '@/lib/import/dedup';

export const dynamic = 'force-dynamic';

export default async function ImportPeoplePage() {
  const [artists, videographers] = await Promise.all([
    db.query.artists.findMany({ orderBy: schema.artists.name }),
    db.query.videographers.findMany({ orderBy: schema.videographers.name }),
  ]);

  const existing: ExistingPerson[] = [
    ...artists.map((row) => ({
      id: row.id,
      role: 'artist' as const,
      name: row.name,
      handle: row.handle,
      email: row.email,
      phone: row.phone,
      location: row.location,
      status: null,
      notes: row.notes,
    })),
    ...videographers.map((row) => ({
      id: row.id,
      role: 'videographer' as const,
      name: row.name,
      handle: row.handle,
      email: row.email,
      phone: row.phone,
      location: row.location,
      status: row.status,
      notes: row.notes,
    })),
  ];

  return (
    <PageShell
      title="Import osób"
      description="Wgraj arkusz xlsx z twórcami albo kamerzystami. Przed zapisem zobaczysz suchy przebieg."
    >
      <ImportShell existing={existing} />
    </PageShell>
  );
}
