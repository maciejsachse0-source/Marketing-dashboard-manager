import { PageShell } from '@/components/page-shell';
import { listVideographers } from '@/server/actions/videographers';
import { VideographersShell } from '@/components/videographers/videographers-shell';

export const dynamic = 'force-dynamic';

export default async function VideographersPage() {
  const videographers = await listVideographers();

  return (
    <PageShell
      title="Kamerzyści"
      description="Baza kamerzystów na nagrania kolab — sprzęt, stawki, dostępność."
    >
      <VideographersShell videographers={videographers} />
    </PageShell>
  );
}
