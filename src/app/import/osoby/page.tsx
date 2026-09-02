import { PageShell } from '@/components/page-shell';
import { ImportShell } from '@/components/import/import-shell';
import { db, schema } from '@/lib/db';
import { existingPeople } from '@/lib/import/existing';

export const dynamic = 'force-dynamic';

export default async function ImportPeoplePage() {
  const existing = await existingPeople(db, schema);

  return (
    <PageShell
      title="Import osób"
      description="Wgraj arkusz xlsx z twórcami albo kamerzystami. Przed zapisem zobaczysz suchy przebieg."
    >
      <ImportShell existing={existing} />
    </PageShell>
  );
}
