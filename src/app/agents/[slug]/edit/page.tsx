import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { AgentForm } from '@/components/agents/agent-form';
import { getAgent } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  return (
    <PageShell
      title={`Edytuj: ${agent.name}`}
      description={
        <>
          Zmiany zapisują plik <code>data/agents/{agent.slug}.json</code>. Plik{' '}
          <code>agents/{agent.slug}.md</code> (persona dla Claude Code) zostaje bez zmian — jeśli
          chcesz, zsynchronizuj go ręcznie.
        </>
      }
      actions={
        <Link
          href={`/agents/${agent.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← powrót
        </Link>
      }
    >
      <AgentForm mode="edit" agent={agent} />
    </PageShell>
  );
}
