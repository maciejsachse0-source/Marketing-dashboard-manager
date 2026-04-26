import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { AgentForm } from '@/components/agents/agent-form';
import { loadAgents, getAgent } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ clone?: string }>;
}) {
  const sp = await searchParams;
  const cloneSlug = sp.clone;
  const cloneFrom = cloneSlug ? getAgent(cloneSlug) : undefined;
  if (cloneSlug && !cloneFrom) notFound();
  const agents = loadAgents();

  return (
    <PageShell
      title={cloneFrom ? `Klonuj: ${cloneFrom.name}` : 'Nowy agent'}
      description={
        cloneFrom
          ? 'Edytuj kopię — zmień slug + nazwę, dostosuj system prompt.'
          : 'Każdy agent to persona dla Claude Code. Po zapisie pojawi się w sidebarze i na pulpicie.'
      }
    >
      {!cloneFrom ? (
        <details className="mb-6 rounded-md border border-border bg-muted/20 px-4 py-3 max-w-3xl">
          <summary className="text-sm font-medium cursor-pointer select-none">
            …albo zacznij od kopii istniejącego agenta
          </summary>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {agents.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/agents/new?clone=${a.slug}`}
                  className="block rounded border border-border bg-card/50 px-3 py-2 text-sm hover:border-foreground/30 transition"
                >
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{a.description}</div>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <AgentForm mode="create" cloneFrom={cloneFrom} />

      {cloneFrom ? (
        <p className="text-xs text-muted-foreground mt-4">
          Anuluj? Wróć do{' '}
          <Link href={`/agents/${cloneFrom.slug}`} className="underline">
            {cloneFrom.name}
          </Link>
          .
        </p>
      ) : null}
    </PageShell>
  );
}
